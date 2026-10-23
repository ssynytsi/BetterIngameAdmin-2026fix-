---@class BiaManager
-- Server side of BetterIngameAdmin v3:
--   persistent map queue, ban/admin lists, map votes, admin say/yell,
--   maplist reload, instavote and a persistent admin action log.
-- require('BiaManager') in ext/Server/__init__.lua (already there).
BiaManager = class 'BiaManager'

---@type GameAdmin
local m_GameAdmin = require('GameAdmin')
---@type ServerOwner
local m_ServerOwner = require('ServerOwner')

local LOG_KEEP = 1000       -- hard cap on rows (only rows older than LOG_PROTECT_DAYS are ever trimmed)
local LOG_MAX_AGE_DAYS = 6  -- auto-clean deletes rows this old or older...
local LOG_CLEAN_EVERY_DAYS = 6 -- ...and runs once every this many days
local LOG_PROTECT_DAYS = 3  -- the last N calendar days that HAVE log entries (before today) are never
                            -- auto-deleted, however old they are; today is always kept too
local LOG_SEND = 100        -- rows sent to the WebUI
local VOTE_SECONDS = 30
local VOTE_SHARE = 0.5      -- share of players needed for a map vote to pass early
local YELL_SECONDS = "8"
local FAV_MAX = 10
local BIGYELL_SECONDS = 6
-- End-of-round screen profiles (seconds): menu / win message / scoreboard.
-- Instavote = Insta button. Regular = passed votes, Next Round, Force next,
-- and natural round ends.
local EOR_DEFAULTS = {
	insta = { menu = 2, msg = 2, board = 2 },
	regular = { menu = 15, msg = 4, board = 4 }
}
local EOR_MIN, EOR_MAX = 2, 60 -- values under 2s can crash the game
-- How Insta / Next Round / Force next change the map:
--  'endround' = mapList.endRound (real end of round, EOR screen with the profile above)
--  'restart'  = mapList.runNextRound, then mapList.restartRound once the new map
--               has loaded (no EOR screen; the restart resets scores)
local MAP_CHANGE_MODES = { endround = true, restart = true }
local RESTART_DELAY = 2 -- seconds after the new level loads
local ROT_MIN_MAP_SECONDS = 180 -- maps shorter than this don't count at all in rotation stats (map, kills, deaths, score)
local INSTA_COOLDOWN = 120 -- seconds between instavotes by regular players (admins bypass)

local function Popup(p_Player, p_Title, p_Text)
	NetEvents:SendTo('PopupResponse', p_Player, { p_Title, p_Text })
end

local function DecodePayload(p_Payload)
	if type(p_Payload) == 'table' then
		return p_Payload
	end
	if type(p_Payload) == 'string' then
		return json.decode(p_Payload)
	end
	return nil
end

-- cut to at most p_Max bytes without splitting a multi-byte UTF-8 character
local function Utf8Cut(p_Text, p_Max)
	if #p_Text <= p_Max then
		return p_Text
	end

	local s_End = p_Max

	-- step back over continuation bytes (10xxxxxx) to the start of the char
	while s_End > 0 and p_Text:byte(s_End + 1) ~= nil and p_Text:byte(s_End + 1) >= 128 and p_Text:byte(s_End + 1) < 192 do
		s_End = s_End - 1
	end

	return p_Text:sub(1, s_End)
end

local function Timestamp()
	if os ~= nil and os.date ~= nil then
		local s_Ok, s_Time = pcall(os.date, '%Y-%m-%d %H:%M')
		if s_Ok and s_Time ~= nil then
			return s_Time
		end
	end
	return string.format('+%ds', math.floor(SharedUtils:GetTime()))
end

function BiaManager:__init()
	self.m_QueueRandom = false
	self.m_Queue = {}
	self.m_QueueLoaded = false
	self.m_Log = {}
	self.m_LogLoaded = false
	self.m_MapVote = nil
	self.m_VoteTick = 0
	self.m_WarmupUntil = 0
	self.m_MapCount = 0
	self.m_InstaReadyAt = 0
	self.m_RoundEndWait = nil  -- loaded lazily from mod.db
	self.m_RoundEndAt = nil

	NetEvents:Subscribe('SaveMapQueue', self, self.OnSaveMapQueue)
	NetEvents:Subscribe('GetMapQueue', self, self.OnGetMapQueue)
	NetEvents:Subscribe('GetBanList', self, self.OnGetBanList)
	NetEvents:Subscribe('UnbanPlayer', self, self.OnUnbanPlayer)
	NetEvents:Subscribe('GetAdminList', self, self.OnGetAdminList)
	NetEvents:Subscribe('AddAdmin', self, self.OnAddAdmin)
	NetEvents:Subscribe('RemoveAdmin', self, self.OnRemoveAdmin)
	NetEvents:Subscribe('ForceNextFromQueue', self, self.OnForceNextFromQueue)
	NetEvents:Subscribe('AnnounceQueue', self, self.OnAnnounceQueue)
	NetEvents:Subscribe('StartMapVote', self, self.OnStartMapVote)
	NetEvents:Subscribe('MapVoteYes', self, self.OnMapVoteYes)
	NetEvents:Subscribe('MapVoteNo', self, self.OnMapVoteNo)

	-- v3
	NetEvents:Subscribe('BiaGetMapRotation', self, self.OnGetMapRotation)
	NetEvents:Subscribe('BiaReloadMapList', self, self.OnReloadMapList)
	NetEvents:Subscribe('BiaInstaMap', self, self.OnInstaMap)
	NetEvents:Subscribe('BiaSay', self, self.OnSay)
	NetEvents:Subscribe('BiaCancelMapVote', self, self.OnCancelMapVote)
	NetEvents:Subscribe('BiaGetAdminLog', self, self.OnGetAdminLog)
	NetEvents:Subscribe('BiaGetFavs', self, self.OnGetFavs)
	NetEvents:Subscribe('BiaSaveFav', self, self.OnSaveFav)
	NetEvents:Subscribe('BiaDeleteFav', self, self.OnDeleteFav)
	NetEvents:Subscribe('BiaApplyFav', self, self.OnApplyFav)
	NetEvents:Subscribe('BiaClearAdminLog', self, self.OnClearAdminLog)
	NetEvents:Subscribe('BiaGetEnemyKits', self, self.OnGetEnemyKits)
	NetEvents:Subscribe('BiaSetEnemyKits', self, self.OnSetEnemyKits)
	NetEvents:Subscribe('BiaGetRotationStats', self, self.OnGetRotationStats)
	NetEvents:Subscribe('BiaGetEorProfiles', self, self.OnGetEorProfiles)
	NetEvents:Subscribe('BiaSetEorProfile', self, self.OnSetEorProfile)
	NetEvents:Subscribe('BiaSetMapChangeMode', self, self.OnSetMapChangeMode)
	self:RegisterEorRcon()
	NetEvents:Subscribe('BiaResetRotationStats', self, self.OnResetRotationStats)
	NetEvents:Subscribe('BiaGetRoundEnd', self, self.OnGetRoundEnd)
	NetEvents:Subscribe('BiaSetRoundEnd', self, self.OnSetRoundEnd)

	Events:Subscribe('Server:RoundOver', self, self.OnRoundOver)
	Events:Subscribe('Level:Destroy', self, self.OnLevelDestroy)
	Events:Subscribe('Level:LoadResources', self, function(self)
		self:SendEor('regular')
	end)

	-- Admin.lua (and anything else) logs through this event
	Events:Subscribe('BIA:Log', self, self.OnLog)

	Events:Subscribe('Level:Loaded', self, self.OnLevelLoaded)
	Events:Subscribe('Player:Authenticated', self, self.OnPlayerAuthenticated)
	Events:Subscribe('Engine:Update', self, self.OnEngineUpdate)
end

-- The server owner is not in gameAdmin's adminList, so every CanX check returns
-- false for them. Owner always passes.
function BiaManager:IsAllowed(p_Name, p_Right)
	if m_ServerOwner:IsOwner(p_Name) then
		return true
	end

	if p_Right == 'map' then
		return m_GameAdmin:CanUseMapFunctions(p_Name)
	elseif p_Right == 'ban' then
		return m_GameAdmin:CanPermanentlyBanPlayers(p_Name)
	elseif p_Right == 'admin' then
		return m_GameAdmin:CanEditGameAdminList(p_Name)
	elseif p_Right == 'any' then
		return m_GameAdmin:IsAdmin(p_Name)
	end

	return false
end

-- Region mod.db (every path closes the handle)

function BiaManager:OpenDb()
	if not SQL:Open() then
		print('BIA - SQL:Open failed')
		return false
	end

	local s_Tables = {
		[[CREATE TABLE IF NOT EXISTS map_queue (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			position INTEGER,
			map_index INTEGER,
			map_name TEXT,
			map_mode TEXT,
			is_random BOOLEAN
		)]],
		[[CREATE TABLE IF NOT EXISTS admin_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ts TEXT,
			admin TEXT,
			text TEXT
		)]],
		[[CREATE TABLE IF NOT EXISTS fav_queues (
			name TEXT PRIMARY KEY,
			data TEXT,
			updated TEXT
		)]],
		[[CREATE TABLE IF NOT EXISTS bia_settings (
			key TEXT PRIMARY KEY,
			value TEXT
		)]],
		[[CREATE TABLE IF NOT EXISTS rotation_stats (
			name TEXT PRIMARY KEY,
			kills INTEGER,
			deaths INTEGER,
			score INTEGER,
			maps INTEGER
		)]]
	}

	for _, l_Query in ipairs(s_Tables) do
		if not SQL:Query(l_Query) then
			print('BIA - SQL create failed: ' .. tostring(SQL:Error()))
			SQL:Close()
			return false
		end
	end

	-- one-time upgrade of an older mod.db: admin_log gets a unix-time column
	-- so cleanup can compare real dates. ALTER fails harmlessly if it exists.
	if not self.m_DbMigrated then
		self.m_DbMigrated = true
		SQL:Query('ALTER TABLE admin_log ADD COLUMN created INTEGER')
		SQL:Query([[UPDATE admin_log SET created = CAST(strftime('%s', ts) AS INTEGER)
			WHERE created IS NULL AND ts LIKE '____-__-__ __:__']])
		SQL:Query([[UPDATE admin_log SET created = CAST(strftime('%s', 'now') AS INTEGER) WHERE created IS NULL]])
	end

	return true
end

-- current time from SQLite (no dependency on Lua's os library in VU)
-- WHERE-clause fragment: row is NOT on today's date and NOT on one of the
-- LOG_PROTECT_DAYS most recent dates (before today) that have entries.
-- Bind: now, now (both unix seconds). Gaps don't count: with entries on
-- 9/12, 9/15, 9/16 and new ones on 9/18, all four dates are kept.
local LOG_UNPROTECTED_SQL = [[
	date(created, 'unixepoch', 'localtime') <> date(?, 'unixepoch', 'localtime')
	AND date(created, 'unixepoch', 'localtime') NOT IN (
		SELECT d FROM (
			SELECT DISTINCT date(created, 'unixepoch', 'localtime') AS d FROM admin_log
			WHERE date(created, 'unixepoch', 'localtime') < date(?, 'unixepoch', 'localtime')
			ORDER BY d DESC LIMIT ]] .. LOG_PROTECT_DAYS .. [[
		)
	)]]

local function DbNow()
	local s_Rows = SQL:Query([[SELECT CAST(strftime('%s', 'now') AS INTEGER) AS now,
		strftime('%Y-%m-%d %H:%M', 'now', 'localtime') AS ts]])

	if s_Rows and s_Rows[1] then
		return tonumber(s_Rows[1]['now']) or 0, tostring(s_Rows[1]['ts'] or '')
	end

	return 0, Timestamp()
end

function BiaManager:GetSetting(p_Key)
	if not self:OpenDb() then
		return nil
	end

	local s_Rows = SQL:Query('SELECT value FROM bia_settings WHERE key = ?', p_Key)
	SQL:Close()

	if s_Rows and s_Rows[1] then
		return s_Rows[1]['value']
	end

	return nil
end

function BiaManager:SetSetting(p_Key, p_Value)
	if not self:OpenDb() then
		return
	end

	SQL:Query('INSERT OR REPLACE INTO bia_settings (key, value) VALUES (?, ?)', p_Key, tostring(p_Value))
	SQL:Close()
end

function BiaManager:LoadQueue()
	if not self:OpenDb() then
		return
	end

	local s_Results = SQL:Query('SELECT * FROM map_queue ORDER BY position ASC')
	SQL:Close()

	self.m_Queue = {}
	self.m_QueueRandom = false

	if not s_Results then
		return
	end

	for _, l_Row in pairs(s_Results) do
		if l_Row['is_random'] == 1 or l_Row['is_random'] == true then
			self.m_QueueRandom = true
		end

		local s_Index = tonumber(l_Row['map_index'])

		if s_Index ~= nil then
			table.insert(self.m_Queue, {
				index = s_Index,
				name = tostring(l_Row['map_name'] or ''),
				mode = tostring(l_Row['map_mode'] or '')
			})
		end
	end

	print('BIA - QUEUE - Loaded ' .. #self.m_Queue .. ' queued map(s) (random=' .. tostring(self.m_QueueRandom) .. ')')
end

function BiaManager:SaveQueue()
	if not self:OpenDb() then
		return false
	end

	-- one transaction instead of one disk sync per row
	local s_InTx = SQL:Query('BEGIN TRANSACTION') and true or false

	if not SQL:Query('DELETE FROM map_queue') then
		print('BIA - QUEUE - Failed to clear table: ' .. tostring(SQL:Error()))
		if s_InTx then SQL:Query('ROLLBACK') end
		SQL:Close()
		return false
	end

	local s_RandomFlag = self.m_QueueRandom and 1 or 0

	for i, l_Entry in ipairs(self.m_Queue) do
		if not SQL:Query('INSERT INTO map_queue (position, map_index, map_name, map_mode, is_random) VALUES (?, ?, ?, ?, ?)',
			i, tonumber(l_Entry.index) or 0, tostring(l_Entry.name or ''), tostring(l_Entry.mode or ''), s_RandomFlag) then
			print('BIA - QUEUE - Failed to insert row ' .. i .. ': ' .. tostring(SQL:Error()))
			if s_InTx then SQL:Query('ROLLBACK') end
			SQL:Close()
			return false
		end
	end

	if s_InTx then
		SQL:Query('COMMIT')
	end

	SQL:Close()
	return true
end

function BiaManager:LoadLog()
	self.m_LogLoaded = true

	if not self:OpenDb() then
		return
	end

	local s_Results = SQL:Query('SELECT * FROM admin_log ORDER BY id DESC LIMIT ' .. LOG_SEND)
	SQL:Close()

	self.m_Log = {}

	if not s_Results then
		return
	end

	-- newest first
	for _, l_Row in pairs(s_Results) do
		table.insert(self.m_Log, {
			t = tostring(l_Row['ts'] or ''),
			text = tostring(l_Row['text'] or '')
		})
	end
end

-- Events:Dispatch('BIA:Log', adminName, text)
function BiaManager:OnLog(p_Admin, p_Text)
	if not self.m_LogLoaded then
		self:LoadLog()
	end

	if not self:OpenDb() then
		return
	end

	local s_Now, s_Ts = DbNow()
	local s_Entry = { t = s_Ts, text = tostring(p_Text or '') }
	table.insert(self.m_Log, 1, s_Entry)

	while #self.m_Log > LOG_SEND do
		table.remove(self.m_Log)
	end

	if not SQL:Query('INSERT INTO admin_log (ts, admin, text, created) VALUES (?, ?, ?, ?)', s_Ts, tostring(p_Admin or ''), s_Entry.text, s_Now) then
		print('BIA - LOG - insert failed: ' .. tostring(SQL:Error()))
	end

	-- size cap, never touching protected days
	SQL:Query('DELETE FROM admin_log WHERE id NOT IN (SELECT id FROM admin_log ORDER BY id DESC LIMIT ' .. LOG_KEEP .. ') AND ' .. LOG_UNPROTECTED_SQL,
		s_Now, s_Now)
	SQL:Close()
end

-- Runs on every level load, but only acts once every LOG_CLEAN_EVERY_DAYS:
-- deletes rows LOG_MAX_AGE_DAYS old or older, except rows from today and
-- from the LOG_PROTECT_DAYS most recent dates that have entries.
function BiaManager:AutoCleanLog()
	if not self:OpenDb() then
		return
	end

	local s_Now = DbNow()
	local s_LastRows = SQL:Query("SELECT value FROM bia_settings WHERE key = 'log_cleaned_at'")
	local s_Last = s_LastRows and s_LastRows[1] and tonumber(s_LastRows[1]['value']) or nil

	if s_Now <= 0 then
		SQL:Close()
		return
	end

	if s_Last == nil then
		-- first run: start the 6-day clock now, delete nothing yet
		SQL:Query("INSERT OR REPLACE INTO bia_settings (key, value) VALUES ('log_cleaned_at', ?)", tostring(s_Now))
		SQL:Close()
		return
	end

	if s_Now - s_Last < LOG_CLEAN_EVERY_DAYS * 86400 then
		SQL:Close()
		return
	end

	SQL:Query('DELETE FROM admin_log WHERE created <= ? AND ' .. LOG_UNPROTECTED_SQL,
		s_Now - LOG_MAX_AGE_DAYS * 86400, s_Now, s_Now)
	local s_Changed = SQL:Query('SELECT changes() AS n')
	local s_Deleted = s_Changed and s_Changed[1] and tonumber(s_Changed[1]['n']) or 0
	SQL:Query("INSERT OR REPLACE INTO bia_settings (key, value) VALUES ('log_cleaned_at', ?)", tostring(s_Now))
	SQL:Close()

	print('BIA - LOG - auto-clean removed ' .. s_Deleted .. ' entr(y/ies) older than ' .. LOG_MAX_AGE_DAYS .. ' days')

	if s_Deleted > 0 then
		self:LoadLog()
	end
end

function BiaManager:OnClearAdminLog(p_Player)
	-- clearing the log removes the audit trail, so it needs admin-list rights (or owner)
	if not self:IsAllowed(p_Player.name, 'admin') then
		Popup(p_Player, 'Not allowed.', 'Clearing the admin log needs the "Can Edit Rights" permission or server owner.')
		return
	end

	if self:OpenDb() then
		SQL:Query('DELETE FROM admin_log')
		SQL:Close()
	end

	self.m_Log = {}
	self.m_LogLoaded = true
	-- the clear itself is the first entry of the fresh log
	self:Log(p_Player.name, p_Player.name .. ' cleared the admin log')
	NetEvents:SendTo('BiaAdminLog', p_Player, self.m_Log)
end

function BiaManager:Log(p_Admin, p_Text)
	print('BIA - ' .. p_Text)
	self:OnLog(p_Admin, p_Text)
end

-- Endregion

-- Region map list

-- mapList.list returns at most 100 maps per call (BF3 RCON), so page through
-- with an offset. Returns { {count, wordsPerMap, words...}, {current, next} }
-- which is exactly what the WebUI's getCurrentMapRotation() expects.
function BiaManager:GetMapRotationArgs()
	local s_Words = {}
	local s_WordsPerMap = 3
	local s_Total = 0
	local s_Offset = 0

	for _ = 1, 20 do
		local s_Resp

		if s_Offset == 0 then
			s_Resp = RCON:SendCommand('mapList.list')
		else
			s_Resp = RCON:SendCommand('mapList.list', { tostring(s_Offset) })
		end

		if s_Resp == nil or s_Resp[1] ~= 'OK' then
			break
		end

		local s_Count = tonumber(s_Resp[2]) or 0
		s_WordsPerMap = tonumber(s_Resp[3]) or 3

		for i = 4, 3 + s_Count * s_WordsPerMap do
			table.insert(s_Words, s_Resp[i] or '')
		end

		s_Total = s_Total + s_Count

		if s_Count < 100 then
			break
		end

		s_Offset = s_Offset + s_Count
	end

	local s_List = { tostring(s_Total), tostring(s_WordsPerMap) }

	for _, l_Word in ipairs(s_Words) do
		table.insert(s_List, l_Word)
	end

	local s_Indices = ' '
	local s_Idx = RCON:SendCommand('mapList.getMapIndices')

	if s_Idx ~= nil and s_Idx[2] ~= nil then
		table.remove(s_Idx, 1)
		s_Indices = s_Idx
	end

	self.m_MapCount = s_Total
	return { s_List, s_Indices }, s_Total
end

function BiaManager:BroadcastMapRotation()
	local s_Args = self:GetMapRotationArgs()
	NetEvents:Broadcast('MapRotation', s_Args)
end

function BiaManager:OnGetMapRotation(p_Player)
	local s_Args = self:GetMapRotationArgs()
	NetEvents:SendTo('BiaMapRotation', p_Player, s_Args)
end

function BiaManager:OnReloadMapList(p_Player)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	local s_Resp = RCON:SendCommand('mapList.load')

	if s_Resp == nil or s_Resp[1] ~= 'OK' then
		local s_Parts = {}

		if s_Resp ~= nil then
			for _, l_Word in ipairs(s_Resp) do
				table.insert(s_Parts, tostring(l_Word))
			end
		end

		local s_Reason = #s_Parts > 0 and table.concat(s_Parts, ' ') or 'no response'
		print('BIA - MAPLIST - mapList.load failed: ' .. s_Reason)
		Popup(p_Player, 'Reload failed.', 'Server said: ' .. s_Reason .. '. The whole file is rejected if ONE line is bad (unknown map name, mode that map does not have, or a hidden BOM / empty line). The old rotation is still active.')
		return
	end

	local s_Args, s_Count = self:GetMapRotationArgs()
	NetEvents:Broadcast('MapRotation', s_Args)
	self:Log(p_Player.name, p_Player.name .. ' reloaded maplist.txt (' .. s_Count .. ' maps)')
	Popup(p_Player, 'Map list reloaded.', s_Count .. ' maps loaded from maplist.txt. If the order changed, check the queue - it stores list positions.')
end

-- Endregion

-- Region queue

function BiaManager:BroadcastQueue()
	NetEvents:Broadcast('MapQueue', { random = self.m_QueueRandom, maps = self.m_Queue })
end

function BiaManager:ApplyNextMap()
	if #self.m_Queue == 0 then
		return false
	end

	local s_Index = tonumber(self.m_Queue[1].index)

	if s_Index == nil then
		return false
	end

	-- WebUI list is 1-based, mapList.setNextMapIndex is 0-based.
	RCON:SendCommand('mapList.setNextMapIndex', { tostring(s_Index - 1) })
	print('BIA - QUEUE - Next map set to index ' .. (s_Index - 1) .. ' (' .. tostring(self.m_Queue[1].name) .. ')')
	return true
end

function BiaManager:PickRandomHead()
	if self.m_QueueRandom and #self.m_Queue > 1 then
		-- never pick the map that just went to the back (index #queue)
		local s_Pick = MathUtils:GetRandomInt(1, #self.m_Queue - 1)
		local s_Chosen = table.remove(self.m_Queue, s_Pick)
		table.insert(self.m_Queue, 1, s_Chosen)
	end
end

function BiaManager:OnSaveMapQueue(p_Player, p_Payload)
	if not self:IsAllowed(p_Player.name, 'map') then
		print('BIA - QUEUE - Save denied for ' .. p_Player.name)
		return
	end

	local s_Data = DecodePayload(p_Payload)

	if s_Data == nil then
		print('BIA - QUEUE - SaveMapQueue: invalid payload from ' .. p_Player.name)
		return
	end

	self.m_QueueLoaded = true
	self.m_QueueRandom = s_Data.random == true
	self.m_Queue = {}

	if type(s_Data.maps) == 'table' then
		for _, l_Entry in ipairs(s_Data.maps) do
			local s_Index = tonumber(l_Entry.index)

			if s_Index ~= nil and s_Index >= 1 then
				table.insert(self.m_Queue, {
					index = s_Index,
					name = tostring(l_Entry.name or ('MAP ' .. s_Index)),
					mode = tostring(l_Entry.mode or '')
				})
			end
		end
	end

	local s_Ok = self:SaveQueue()

	if #self.m_Queue > 0 then
		self:ApplyNextMap()
		self:BroadcastMapRotation()
	end

	self:BroadcastQueue()

	if s_Ok then
		print('BIA - QUEUE - ' .. p_Player.name .. ' saved queue (' .. #self.m_Queue .. ' maps, random=' .. tostring(self.m_QueueRandom) .. ')')
	else
		print('BIA - QUEUE - Save FAILED for ' .. p_Player.name)
	end
end

function BiaManager:OnGetMapQueue(p_Player)
	NetEvents:SendTo('MapQueue', p_Player, { random = self.m_QueueRandom, maps = self.m_Queue })
end

function BiaManager:OnPlayerAuthenticated(p_Player)
	self:OnGetEnemyKits(p_Player)
	local s_E = self.m_EorActive or self:GetEor('regular')
	NetEvents:SendTo('BIA:EorTimes', p_Player, s_E.menu, s_E.msg, s_E.board)

	if #self.m_Queue > 0 or self.m_QueueRandom then
		NetEvents:SendTo('MapQueue', p_Player, { random = self.m_QueueRandom, maps = self.m_Queue })
	end
end

-- The queue only advances when the map that actually loaded IS the queue
-- head. Insta-loads, votes and manual "Next Round"s of other maps no longer
-- throw away the map that was up next.
function BiaManager:OnLevelLoaded(p_LevelName, p_GameMode, p_Round, p_RoundsPerMap)
	self.m_WarmupUntil = SharedUtils:GetTime() + 12
	self.m_RoundEnding = false
	self.m_LevelStart = SharedUtils:GetTime()

	if self.m_RestartAfterLoad then
		self.m_RestartAfterLoad = false
		self.m_RestartAt = SharedUtils:GetTime() + RESTART_DELAY
	end
	self:SendEor('regular')
	self:ClearMapVote()
	self:AutoCleanLog()
	self:StartRoundStats()

	if not self.m_QueueLoaded then
		self:LoadQueue()
		self.m_QueueLoaded = true
	end

	local s_Args, s_Count = self:GetMapRotationArgs()
	print('BIA - MAPLIST - ' .. s_Count .. ' map(s) in the server rotation')

	if #self.m_Queue > 0 then
		local s_Current = nil

		if type(s_Args[2]) == 'table' then
			s_Current = tonumber(s_Args[2][1])
		end

		local s_Head = tonumber(self.m_Queue[1].index)

		if s_Current == nil or s_Head == nil or s_Head - 1 == s_Current then
			local s_Played = table.remove(self.m_Queue, 1)
			table.insert(self.m_Queue, s_Played)
			self:PickRandomHead()
		else
			print('BIA - QUEUE - Loaded map is not the queue head, queue kept as is')
		end

		self:SaveQueue()
		self:ApplyNextMap()
		self:BroadcastMapRotation()
	end

	self:BroadcastQueue()
end

-- Loads the CURRENT head (the orange "up next" row). The old version rotated
-- the head to the back first, so it skipped exactly the map it promised.
function BiaManager:OnForceNextFromQueue(p_Player)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	if #self.m_Queue == 0 then
		Popup(p_Player, 'Queue empty.', 'Add maps to the queue first.')
		return
	end

	self:ApplyNextMap()
	local s_Name = tostring(self.m_Queue[1].name)
	self:EndRoundWith('regular')
	self:Log(p_Player.name, p_Player.name .. ' forced next map from queue: ' .. s_Name)
	Popup(p_Player, 'Next map forced.', 'Loading: ' .. s_Name)
end

function BiaManager:OnAnnounceQueue(p_Player)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	if #self.m_Queue == 0 then
		RCON:SendCommand('admin.say', { 'Map queue is empty.', 'all' })
		return
	end

	local s_Parts = {}

	for i = 1, math.min(#self.m_Queue, 5) do
		table.insert(s_Parts, i .. '. ' .. tostring(self.m_Queue[i].name))
	end

	if #self.m_Queue > 5 then
		table.insert(s_Parts, '... +' .. (#self.m_Queue - 5) .. ' more')
	end

	local s_Msg = 'Next maps: ' .. table.concat(s_Parts, ' | ')

	if self.m_QueueRandom then
		s_Msg = s_Msg .. ' (random mode)'
	end

	RCON:SendCommand('admin.say', { s_Msg, 'all' })
end

-- Instavote: set + run in one go on the server (index is 1-based from the WebUI).
-- Open to every player. Non-admins share a cooldown so one player can't
-- chain-skip maps; admins/owner bypass it.
function BiaManager:OnInstaMap(p_Player, p_Payload)
	local s_Data = DecodePayload(p_Payload)
	local s_Index, s_Label

	if type(s_Data) == 'table' then
		s_Index = tonumber(s_Data.index)
		s_Label = tostring(s_Data.name or '')

		if s_Data.mode ~= nil and s_Data.mode ~= '' then
			s_Label = s_Label .. ' (' .. tostring(s_Data.mode) .. ')'
		end
	else
		s_Index = tonumber(s_Data or p_Payload)
	end

	if s_Index == nil or s_Index < 1 or (self.m_MapCount > 0 and s_Index > self.m_MapCount) then
		Popup(p_Player, 'Error.', 'That map is not in the rotation anymore. Refresh the list.')
		return
	end

	if s_Label == nil or s_Label == '' then
		s_Label = 'map #' .. s_Index
	end

	local s_IsAdmin = self:IsAllowed(p_Player.name, 'map')
	local s_Now = SharedUtils:GetTime()

	if not s_IsAdmin then
		local s_Wait = math.ceil((self.m_InstaReadyAt or 0) - s_Now)

		if s_Wait > 0 then
			Popup(p_Player, 'Instavote cooling down.', 'The next instavote is available in ' .. s_Wait .. 's.')
			return
		end
	end

	local s_Resp = RCON:SendCommand('mapList.setNextMapIndex', { tostring(s_Index - 1) })

	if s_Resp == nil or s_Resp[1] ~= 'OK' then
		Popup(p_Player, 'Error.', 'mapList.setNextMapIndex failed: ' .. tostring(s_Resp and s_Resp[1]))
		return
	end

	self.m_InstaReadyAt = s_Now + INSTA_COOLDOWN
	self:ClearMapVote()
	RCON:SendCommand('admin.say', { p_Player.name .. ' instavoted: ' .. s_Label .. ' - loading now.', 'all' })
	self:EndRoundWith('insta')
	self:Log(p_Player.name, p_Player.name .. ' insta-loaded ' .. s_Label)
end

-- Endregion

-- Region say / yell

function BiaManager:OnSay(p_Player, p_Payload)
	if not self:IsAllowed(p_Player.name, 'any') then
		return
	end

	local s_Data = DecodePayload(p_Payload)

	if s_Data == nil then
		return
	end

	local s_Text = tostring(s_Data.text or ''):gsub('[%c]', ' ')
	s_Text = Utf8Cut(s_Text, 110)

	if s_Text:match('^%s*$') then
		return
	end

	if s_Data.yell == 'big' then
		s_Text = Utf8Cut(s_Text, 90)
		NetEvents:Broadcast('BiaBigYell', { text = s_Text, from = p_Player.name, seconds = BIGYELL_SECONDS })
		self:Log(p_Player.name, p_Player.name .. ' BIG-yelled: ' .. s_Text)
	elseif s_Text:find('[\224-\239]') ~= nil then
		-- 3-byte UTF-8 = Chinese/Japanese (Cyrillic is 2-byte and works in
		-- BF3 chat). BF3 can't draw CJK, so every client's BIA draws it.
		local s_Kind = s_Data.yell == true and 'yell' or 'say'
		NetEvents:Broadcast('BiaChatOverlay', { kind = s_Kind, text = s_Text, from = p_Player.name, seconds = tonumber(YELL_SECONDS) })
		self:Log(p_Player.name, p_Player.name .. (s_Kind == 'yell' and ' yelled: ' or ' said: ') .. s_Text)
	elseif s_Data.yell == true then
		RCON:SendCommand('admin.yell', { s_Text, YELL_SECONDS, 'all' })
		self:Log(p_Player.name, p_Player.name .. ' yelled: ' .. s_Text)
	else
		RCON:SendCommand('admin.say', { '[' .. p_Player.name .. '] ' .. s_Text, 'all' })
		self:Log(p_Player.name, p_Player.name .. ' said: ' .. s_Text)
	end
end

-- Endregion

-- Region ban list

function BiaManager:FormatBanDuration(p_BanType, p_Value)
	if p_BanType == 'perm' then
		return 'permanent'
	end

	if p_BanType == 'rounds' then
		return (p_Value or '?') .. ' round(s)'
	end

	local s_Seconds = tonumber(p_Value)

	if s_Seconds == nil then
		return 'unknown'
	end

	local s_Minutes = s_Seconds / 60

	if s_Minutes < 60 then
		return string.format('%.0f min', s_Minutes)
	end

	local s_Hours = s_Minutes / 60

	if s_Hours < 24 then
		return string.format('%.1f hrs', s_Hours)
	end

	return string.format('%.1f days', s_Hours / 24)
end

function BiaManager:OnGetBanList(p_Player)
	if not self:IsAllowed(p_Player.name, 'ban') then
		return
	end

	local s_Bans = {}
	local s_Offset = 0

	-- banList.list is paged (100 per call) just like mapList.list
	for _ = 1, 10 do
		local s_Response

		if s_Offset == 0 then
			s_Response = RCON:SendCommand('banList.list')
		else
			s_Response = RCON:SendCommand('banList.list', { tostring(s_Offset) })
		end

		if s_Response == nil or s_Response[1] ~= 'OK' then
			break
		end

		local i = 2
		local s_PageCount = 0

		while s_Response[i] ~= nil and s_Response[i + 1] ~= nil do
			local s_IdType = s_Response[i]
			local s_Id = s_Response[i + 1]

			if s_IdType == 'name' or s_IdType == 'guid' then
				table.insert(s_Bans, {
					name = s_Id,
					idType = s_IdType,
					reason = self:FormatBanDuration(s_Response[i + 2], s_Response[i + 3]) .. ' - ' .. (s_Response[i + 4] or 'no reason')
				})
			end

			s_PageCount = s_PageCount + 1
			i = i + 5
		end

		if s_PageCount < 100 then
			break
		end

		s_Offset = s_Offset + s_PageCount
	end

	NetEvents:SendTo('BanList', p_Player, s_Bans)
end

function BiaManager:OnUnbanPlayer(p_Player, p_Name)
	if not self:IsAllowed(p_Player.name, 'ban') then
		return
	end

	-- the list shows name AND guid bans; try both id types
	RCON:SendCommand('banList.remove', { 'name', p_Name })
	RCON:SendCommand('banList.remove', { 'guid', p_Name })
	RCON:SendCommand('banList.save')
	self:Log(p_Player.name, p_Player.name .. ' unbanned ' .. tostring(p_Name))

	Popup(p_Player, 'Unbanned.', tostring(p_Name) .. ' has been removed from the ban list.')
	self:OnGetBanList(p_Player)
end

-- Endregion

-- Region admin list

function BiaManager:OnGetAdminList(p_Player)
	if not self:IsAllowed(p_Player.name, 'admin') then
		return
	end

	local s_Admins = {}
	local s_OwnerResponse = RCON:SendCommand('vars.serverOwner')

	if s_OwnerResponse ~= nil and s_OwnerResponse[2] ~= nil and s_OwnerResponse[2] ~= 'OwnerNotSet' then
		table.insert(s_Admins, { name = s_OwnerResponse[2], rights = 'server owner (all rights)' })
	end

	local s_Response = RCON:SendCommand('gameAdmin.list')

	if s_Response ~= nil and s_Response[1] == 'OK' then
		local i = 2

		while s_Response[i] ~= nil do
			local s_Count = tonumber(s_Response[i + 1])

			if s_Count == nil then
				break
			end

			table.insert(s_Admins, { name = s_Response[i], rights = s_Count .. ' right(s)' })
			i = i + 2 + s_Count
		end
	end

	NetEvents:SendTo('AdminList', p_Player, s_Admins)
end

function BiaManager:OnAddAdmin(p_Player, p_Name)
	if not self:IsAllowed(p_Player.name, 'admin') then
		return
	end

	if type(p_Name) ~= 'string' or p_Name == '' then
		return
	end

	if string.sub(p_Name, 1, 4) == 'BOT_' then
		Popup(p_Player, 'That is a bot.', p_Name .. ' cannot be promoted.')
		return
	end

	-- name + 13 rights, order required by gameAdmin
	RCON:SendCommand('gameAdmin.add', {
		p_Name,
		'true',  -- canMovePlayers
		'true',  -- canKillPlayers
		'true',  -- canKickPlayers
		'false', -- canTemporaryBanPlayers
		'false', -- canPermanentlyBanPlayers
		'false', -- canEditGameAdminList
		'false', -- canEditBanList
		'false', -- canEditMapList
		'false', -- canUseMapFunctions
		'false', -- canAlterServerSettings
		'false', -- canEditReservedSlotsList
		'false', -- canEditTextChatModerationList
		'false'  -- canShutdownServer
	})
	RCON:SendCommand('gameAdmin.save')
	self:Log(p_Player.name, p_Player.name .. ' promoted ' .. p_Name .. ' to admin')

	Popup(p_Player, 'Admin added.', p_Name .. ' is now an admin with move, kill and kick rights.')
	self:OnGetAdminList(p_Player)
end

function BiaManager:OnRemoveAdmin(p_Player, p_Name)
	if not self:IsAllowed(p_Player.name, 'admin') then
		return
	end

	RCON:SendCommand('gameAdmin.remove', { p_Name })
	RCON:SendCommand('gameAdmin.save')
	self:Log(p_Player.name, p_Player.name .. ' removed admin ' .. tostring(p_Name))

	self:OnGetAdminList(p_Player)
end

function BiaManager:OnGetAdminLog(p_Player)
	if not self:IsAllowed(p_Player.name, 'any') then
		return
	end

	if not self.m_LogLoaded then
		self:LoadLog()
	end

	NetEvents:SendTo('BiaAdminLog', p_Player, self.m_Log)
end

-- Endregion

-- Region map vote

function BiaManager:ClearMapVote(p_Silent)
	if self.m_MapVote ~= nil and not p_Silent then
		NetEvents:Broadcast('MapVoteEnd', { success = false, name = self.m_MapVote.name or '', cancelled = true })
	end

	self.m_MapVote = nil
end

function BiaManager:VoteCounts()
	return {
		yes = self.m_MapVote.yesCount,
		no = self.m_MapVote.noCount,
		needed = self.m_MapVote.needed
	}
end

function BiaManager:OnStartMapVote(p_Player, p_Payload)
	if SharedUtils:GetTime() < (self.m_WarmupUntil or 0) then
		Popup(p_Player, "Can't vote in pre-round.", 'Wait until the round has started, then try again.')
		return
	end

	if self.m_MapVote ~= nil then
		Popup(p_Player, 'Vote in progress.', 'A map vote is already running.')
		return
	end

	local s_Data = DecodePayload(p_Payload)

	if s_Data == nil then
		return
	end

	-- 1-based list position, same base as the queue
	local s_Index = tonumber(s_Data.index)

	if s_Index == nil or s_Index < 1 or (self.m_MapCount > 0 and s_Index > self.m_MapCount) then
		return
	end

	local s_Name = tostring(s_Data.name or 'Map')
	local s_Mode = tostring(s_Data.mode or '')
	local s_PlayerCount = 0

	for _, l_Player in pairs(PlayerManager:GetPlayers()) do
		-- bots never vote, so they must not raise the bar either
		if string.sub(l_Player.name, 1, 4) ~= 'BOT_' then
			s_PlayerCount = s_PlayerCount + 1
		end
	end

	self.m_MapVote = {
		index = s_Index,
		name = s_Name,
		mode = s_Mode,
		starter = p_Player.name,
		yes = { [p_Player.name] = true },
		no = {},
		yesCount = 1,
		noCount = 0,
		endsAt = SharedUtils:GetTime() + VOTE_SECONDS,
		needed = math.max(1, math.ceil(s_PlayerCount * VOTE_SHARE))
	}

	NetEvents:Broadcast('MapVoteStart', {
		name = s_Name,
		mode = s_Mode,
		seconds = VOTE_SECONDS,
		yes = 1,
		no = 0,
		needed = self.m_MapVote.needed
	})

	RCON:SendCommand('admin.say', {
		p_Player.name .. ' started a vote for next map: ' .. s_Name .. (s_Mode ~= '' and (' (' .. s_Mode .. ')') or '') .. ' - F8 yes / F9 no',
		'all'
	})
	self:Log(p_Player.name, p_Player.name .. ' started a map vote for ' .. s_Name)

	-- 1-player server: passes immediately
	self:TryResolveMapVote()
end

function BiaManager:CastVote(p_Player, p_Yes)
	local s_Vote = self.m_MapVote

	if s_Vote == nil then
		return
	end

	local s_Name = p_Player.name
	local s_Mine = p_Yes and s_Vote.yes or s_Vote.no
	local s_Other = p_Yes and s_Vote.no or s_Vote.yes

	if s_Mine[s_Name] then
		return
	end

	if s_Other[s_Name] then
		s_Other[s_Name] = nil

		if p_Yes then
			s_Vote.noCount = math.max(0, s_Vote.noCount - 1)
		else
			s_Vote.yesCount = math.max(0, s_Vote.yesCount - 1)
		end
	end

	s_Mine[s_Name] = true

	if p_Yes then
		s_Vote.yesCount = s_Vote.yesCount + 1
	else
		s_Vote.noCount = s_Vote.noCount + 1
	end

	NetEvents:Broadcast('MapVoteUpdate', self:VoteCounts())
	self:TryResolveMapVote()
end

function BiaManager:OnMapVoteYes(p_Player)
	self:CastVote(p_Player, true)
end

function BiaManager:OnMapVoteNo(p_Player)
	self:CastVote(p_Player, false)
end

function BiaManager:OnCancelMapVote(p_Player)
	if not self:IsAllowed(p_Player.name, 'map') or self.m_MapVote == nil then
		return
	end

	local s_Name = self.m_MapVote.name
	self:ClearMapVote()
	RCON:SendCommand('admin.say', { 'Map vote for ' .. s_Name .. ' was cancelled by an admin.', 'all' })
	self:Log(p_Player.name, p_Player.name .. ' cancelled the map vote for ' .. s_Name)
end

function BiaManager:TryResolveMapVote(p_ForceExpire)
	local s_Vote = self.m_MapVote

	if s_Vote == nil then
		return
	end

	local s_Expired = p_ForceExpire or (SharedUtils:GetTime() >= s_Vote.endsAt)
	local s_Passed = s_Vote.yesCount >= s_Vote.needed

	if not s_Expired and not s_Passed then
		return
	end

	local s_Success = s_Vote.yesCount > s_Vote.noCount and s_Vote.yesCount >= 1

	if s_Success then
		local s_Found = nil

		for i, l_Entry in ipairs(self.m_Queue) do
			if tonumber(l_Entry.index) == tonumber(s_Vote.index) then
				s_Found = table.remove(self.m_Queue, i)
				break
			end
		end

		if s_Found == nil then
			s_Found = { index = s_Vote.index, name = s_Vote.name, mode = s_Vote.mode }
		end

		table.insert(self.m_Queue, 1, s_Found)
		self:SaveQueue()
		self:ApplyNextMap()
		self:BroadcastMapRotation()
		self:BroadcastQueue()

		RCON:SendCommand('admin.say', {
			'Map vote passed: ' .. s_Vote.name .. ' is next (' .. s_Vote.yesCount .. 'Y / ' .. s_Vote.noCount .. 'N).',
			'all'
		})
		self:OnLog(s_Vote.starter, 'Map vote passed: ' .. s_Vote.name)
		-- loads at the normal end of this round (Regular profile); Insta is the immediate option
	else
		RCON:SendCommand('admin.say', {
			'Map vote failed for ' .. s_Vote.name .. ' (' .. s_Vote.yesCount .. 'Y / ' .. s_Vote.noCount .. 'N).',
			'all'
		})
	end

	NetEvents:Broadcast('MapVoteEnd', { success = s_Success, name = s_Vote.name })
	self.m_MapVote = nil
end

function BiaManager:OnEngineUpdate(p_Delta)
	if self.m_RestartAt ~= nil and SharedUtils:GetTime() >= self.m_RestartAt then
		self.m_RestartAt = nil
		print('BIA - MAPCHANGE - restartRound (resets scores)')
		RCON:SendCommand('mapList.restartRound')
	end

	if self.m_EorLogAt ~= nil and SharedUtils:GetTime() >= self.m_EorLogAt then
		self.m_EorLogAt = nil
		local s_I, s_R = self:GetEor('insta'), self:GetEor('regular')
		self:Log(self.m_EorLogBy, tostring(self.m_EorLogBy) .. string.format(
			' set end-of-round timing: regular %d/%d/%ds (total %ds), instavote %d/%d/%ds',
			s_R.menu, s_R.msg, s_R.board, s_R.menu + s_R.msg + s_R.board, s_I.menu, s_I.msg, s_I.board))
	end

	if self.m_MapVote == nil then
		return
	end

	self.m_VoteTick = self.m_VoteTick + p_Delta

	if self.m_VoteTick < 0.5 then
		return
	end

	self.m_VoteTick = 0

	if SharedUtils:GetTime() < (self.m_WarmupUntil or 0) then
		print('BIA - MAPVOTE - Cancelled (pre-round / level load)')
		self:ClearMapVote()
		return
	end

	if SharedUtils:GetTime() >= self.m_MapVote.endsAt then
		self:TryResolveMapVote(true)
	end
end

-- Endregion

-- Region favorite queues (max 10, mod.db table fav_queues)

function BiaManager:ReadFavs()
	local s_Favs = {}

	if not self:OpenDb() then
		return s_Favs
	end

	local s_Rows = SQL:Query('SELECT name, data FROM fav_queues ORDER BY name COLLATE NOCASE ASC')
	SQL:Close()

	if not s_Rows then
		return s_Favs
	end

	for _, l_Row in pairs(s_Rows) do
		local s_Data = json.decode(tostring(l_Row['data'] or '')) or {}
		table.insert(s_Favs, {
			name = tostring(l_Row['name'] or ''),
			maps = type(s_Data.maps) == 'table' and s_Data.maps or {},
			random = s_Data.random == true
		})
	end

	return s_Favs
end

function BiaManager:OnGetFavs(p_Player)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	NetEvents:SendTo('BiaFavs', p_Player, self:ReadFavs())
end

function BiaManager:OnSaveFav(p_Player, p_Payload)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	local s_Data = DecodePayload(p_Payload)

	if type(s_Data) ~= 'table' then
		return
	end

	local s_Name = Utf8Cut(tostring(s_Data.name or ''):gsub('[%c]', ' '), 48)

	if s_Name:match('^%s*$') then
		return
	end

	local s_Maps = {}

	if type(s_Data.maps) == 'table' then
		for _, l_Entry in ipairs(s_Data.maps) do
			local s_Index = tonumber(l_Entry.index)

			if s_Index ~= nil and s_Index >= 1 then
				table.insert(s_Maps, { index = s_Index, name = tostring(l_Entry.name or ''), mode = tostring(l_Entry.mode or '') })
			end
		end
	end

	if #s_Maps == 0 then
		return
	end

	local s_Existing = self:ReadFavs()
	local s_Replace = false

	for _, l_Fav in ipairs(s_Existing) do
		if l_Fav.name == s_Name then
			s_Replace = true
		end
	end

	if not s_Replace and #s_Existing >= FAV_MAX then
		Popup(p_Player, 'Favorites full.', 'Delete a saved queue first (max ' .. FAV_MAX .. ').')
		return
	end

	if not self:OpenDb() then
		return
	end

	local s_Json = json.encode({ maps = s_Maps, random = s_Data.random == true })

	if not SQL:Query('INSERT OR REPLACE INTO fav_queues (name, data, updated) VALUES (?, ?, ?)', s_Name, s_Json, Timestamp()) then
		print('BIA - FAVS - save failed: ' .. tostring(SQL:Error()))
	end

	SQL:Close()
	self:Log(p_Player.name, p_Player.name .. ' saved favorite queue "' .. s_Name .. '" (' .. #s_Maps .. ' maps)')
	NetEvents:SendTo('BiaFavs', p_Player, self:ReadFavs())
end

function BiaManager:OnDeleteFav(p_Player, p_Payload)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	local s_Name = DecodePayload(p_Payload)

	if type(s_Name) ~= 'string' then
		s_Name = tostring(p_Payload or '')
	end

	if not self:OpenDb() then
		return
	end

	SQL:Query('DELETE FROM fav_queues WHERE name = ?', s_Name)
	SQL:Close()
	self:Log(p_Player.name, p_Player.name .. ' deleted favorite queue "' .. s_Name .. '"')
	NetEvents:SendTo('BiaFavs', p_Player, self:ReadFavs())
end

-- Load a favorite: every entry is resolved by engine code (map + mode).
-- Entries no longer in the rotation are appended to the LIVE rotation with
-- mapList.add (maplist.txt on disk is untouched), so every map still plays.
-- A later "Reload maplist.txt" drops those extra entries again.
function BiaManager:OnApplyFav(p_Player, p_Payload)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	local s_Data = DecodePayload(p_Payload)

	if type(s_Data) ~= 'table' or type(s_Data.maps) ~= 'table' then
		return
	end

	local s_Args = self:GetMapRotationArgs()
	local s_List = s_Args[1]
	local s_Wpm = tonumber(s_List[2]) or 3
	local s_Count = tonumber(s_List[1]) or 0

	local function FindIndex(p_Map, p_Mode)
		local s_Map = string.lower(p_Map)
		local s_Mode = string.lower(p_Mode)

		for i = 1, s_Count do
			local s_Base = 3 + (i - 1) * s_Wpm

			if string.lower(tostring(s_List[s_Base])) == s_Map and string.lower(tostring(s_List[s_Base + 1])) == s_Mode then
				return i
			end
		end

		return nil
	end

	local s_Queue = {}
	local s_Added = {}
	local s_Failed = {}

	for _, l_Entry in ipairs(s_Data.maps) do
		local s_Map = tostring(l_Entry.map or '')
		local s_Mode = tostring(l_Entry.gm or '')
		local s_Label = tostring(l_Entry.name or s_Map)

		if s_Map ~= '' and s_Mode ~= '' then
			local s_Index = FindIndex(s_Map, s_Mode)

			if s_Index == nil then
				local s_Resp = RCON:SendCommand('mapList.add', { s_Map, s_Mode, '1' })

				if s_Resp ~= nil and s_Resp[1] == 'OK' then
					s_Count = s_Count + 1
					table.insert(s_List, s_Map)
					table.insert(s_List, s_Mode)
					table.insert(s_List, '1')

					for _ = 4, s_Wpm do
						table.insert(s_List, '')
					end

					s_Index = s_Count
					table.insert(s_Added, s_Label)
				else
					table.insert(s_Failed, s_Label .. ' (' .. tostring(s_Resp and s_Resp[1]) .. ')')
				end
			end

			if s_Index ~= nil then
				table.insert(s_Queue, { index = s_Index, name = s_Label, mode = tostring(l_Entry.mode or '') })
			end
		end
	end

	self.m_QueueLoaded = true
	self.m_Queue = s_Queue
	self.m_QueueRandom = s_Data.random == true
	self:SaveQueue()

	if #self.m_Queue > 0 then
		self:ApplyNextMap()
	end

	self:BroadcastMapRotation()
	self:BroadcastQueue()
	self:Log(p_Player.name, p_Player.name .. ' loaded favorite queue "' .. tostring(s_Data.name or '') .. '" (' .. #s_Queue .. ' maps)')

	if #s_Added > 0 or #s_Failed > 0 then
		local s_Msg = ''

		if #s_Added > 0 then
			s_Msg = 'Added to the live rotation: ' .. table.concat(s_Added, ', ') .. '. '
		end

		if #s_Failed > 0 then
			s_Msg = s_Msg .. 'Could not add: ' .. table.concat(s_Failed, ', ') .. ' (map/DLC not installed on the server, or mode not available on that map).'
		end

		Popup(p_Player, 'Favorite loaded.', s_Msg)
	end
end

-- Endregion

-- Region enemy kit icons (server-wide, admin controlled)

function BiaManager:GetHideEnemyKits()
	if self.m_HideEnemyKits == nil then
		self.m_HideEnemyKits = self:GetSetting('hide_enemy_kits') == '1'
	end

	return self.m_HideEnemyKits
end

function BiaManager:OnGetEnemyKits(p_Player)
	NetEvents:SendTo('BiaKitPolicy', p_Player, { hide = self:GetHideEnemyKits() })
end

function BiaManager:OnSetEnemyKits(p_Player, p_Payload)
	if not self:IsAllowed(p_Player.name, 'any') then
		return
	end

	local s_Hide = DecodePayload(p_Payload)
	s_Hide = s_Hide == true or s_Hide == 'true' or s_Hide == 1

	self.m_HideEnemyKits = s_Hide
	self:SetSetting('hide_enemy_kits', s_Hide and '1' or '0')
	NetEvents:Broadcast('BiaKitPolicy', { hide = s_Hide })
	self:Log(p_Player.name, p_Player.name .. (s_Hide and ' hid' or ' showed') .. ' enemy kit icons on the scoreboard')
end

-- Endregion

-- Region end of round (mapList.endRound + EOR screen profiles)
-- mapList.runNextRound aborts the round: no end-of-round sequence, and the
-- players' kills/deaths/score carry into the next map (the engine refuses
-- to reset them from Lua). mapList.endRound <team> runs the real end of
-- round, so stats reset normally. Its screen timing comes from the profile
-- sent to ext/Shared/BiaEndOfRound.lua right before.

function BiaManager:GetEor(p_Kind)
	self.m_Eor = self.m_Eor or {}

	if self.m_Eor[p_Kind] == nil then
		local s_Def = EOR_DEFAULTS[p_Kind]
		local s_Saved = json.decode(self:GetSetting('eor_' .. p_Kind) or '') or {}
		local function C(p_V, p_D)
			return math.max(EOR_MIN, math.min(EOR_MAX, tonumber(p_V) or p_D))
		end

		self.m_Eor[p_Kind] = {
			menu = C(s_Saved.menu, s_Def.menu),
			msg = C(s_Saved.msg, s_Def.msg),
			board = C(s_Saved.board, s_Def.board)
		}
	end

	return self.m_Eor[p_Kind]
end

-- push a profile to the server-side and every client-side copy of the module
function BiaManager:SendEor(p_Kind)
	local s_E = self:GetEor(p_Kind)
	self.m_EorActive = s_E
	Events:Dispatch('BIA:EorTimes', s_E.menu, s_E.msg, s_E.board)
	NetEvents:Broadcast('BIA:EorTimes', s_E.menu, s_E.msg, s_E.board)
end

function BiaManager:WinningTeam()
	local s_Teams = SharedUtils:GetCurrentGameMode() == 'SquadDeathMatch0' and 4 or 2
	local s_Best, s_BestTickets = 1, nil

	for l_Team = 1, s_Teams do
		local s_T = TicketManager:GetTicketCount(l_Team) or 0

		if s_BestTickets == nil or s_T > s_BestTickets then
			s_Best, s_BestTickets = l_Team, s_T
		end
	end

	return s_Best
end

-- End the current round with an EOR profile; the next map loads after it.
function BiaManager:GetMapChangeMode()
	if self.m_MapChangeMode == nil then
		local s_Saved = self:GetSetting('map_change_mode')
		self.m_MapChangeMode = MAP_CHANGE_MODES[s_Saved] and s_Saved or 'endround'
	end

	return self.m_MapChangeMode
end

function BiaManager:OnSetMapChangeMode(p_Player, p_Payload)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	local s_Mode = DecodePayload(p_Payload)

	if type(s_Mode) ~= 'string' then
		s_Mode = tostring(p_Payload)
	end

	if not MAP_CHANGE_MODES[s_Mode] then
		return
	end

	self.m_MapChangeMode = s_Mode
	self:SetSetting('map_change_mode', s_Mode)
	self:Log(p_Player.name, p_Player.name .. ' set map change method to ' .. (s_Mode == 'restart' and 'next map + restart' or 'end round'))
	NetEvents:Broadcast('BiaEorProfiles', self:EorPayload())
end

-- 'restart' mode: hard switch now, restartRound once the new map is loaded
function BiaManager:NextAndRestart(p_Kind)
	self.m_RoundEnding = true
	self.m_RestartAfterLoad = true
	print('BIA - MAPCHANGE - runNextRound, restartRound after load (' .. p_Kind .. ')')
	RCON:SendCommand('mapList.runNextRound')
end

function BiaManager:EndRoundWith(p_Kind)
	if self.m_RoundEnding then
		print('BIA - EOR - round already ending, ignored (' .. p_Kind .. ')')
		return
	end

	if self:GetMapChangeMode() == 'restart' then
		self:NextAndRestart(p_Kind)
		return
	end

	self:SendEor(p_Kind)
	local s_Resp = RCON:SendCommand('mapList.endRound', { tostring(self:WinningTeam()) })

	if s_Resp ~= nil and s_Resp[1] == 'OK' then
		self.m_RoundEnding = true
		local s_E = self:GetEor(p_Kind)
		print('BIA - EOR - endRound (' .. p_Kind .. ', next map in ~' .. (s_E.menu + s_E.msg + s_E.board) .. 's)')
	else
		-- e.g. called during pre-round: fall back to the old hard switch
		print('BIA - EOR - mapList.endRound refused (' .. tostring(s_Resp and s_Resp[1]) .. '), using runNextRound')
		RCON:SendCommand('mapList.runNextRound')
	end
end

function BiaManager:EorPayload()
	return { insta = self:GetEor('insta'), regular = self:GetEor('regular'), mode = self:GetMapChangeMode(), min = EOR_MIN }
end

function BiaManager:OnGetEorProfiles(p_Player)
	NetEvents:SendTo('BiaEorProfiles', p_Player, self:EorPayload())
end

function BiaManager:OnSetEorProfile(p_Player, p_Payload)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	local s_Data = DecodePayload(p_Payload)

	if type(s_Data) ~= 'table' or EOR_DEFAULTS[s_Data.kind] == nil then
		return
	end

	local function Clamp(p_V, p_Old)
		local s_V = math.floor(tonumber(p_V) or p_Old)
		return math.max(EOR_MIN, math.min(EOR_MAX, s_V))
	end

	local s_Old = self:GetEor(s_Data.kind)
	local s_New = { menu = Clamp(s_Data.menu, s_Old.menu), msg = Clamp(s_Data.msg, s_Old.msg), board = Clamp(s_Data.board, s_Old.board) }
	self.m_Eor[s_Data.kind] = s_New
	self:SetSetting('eor_' .. s_Data.kind, json.encode(s_New))

	-- regular is the live profile between map changes
	if s_Data.kind == 'regular' and not self.m_RoundEnding then
		self:SendEor('regular')
	end

	-- one log line, 15s after the last change
	self.m_EorLogAt = SharedUtils:GetTime() + 15
	self.m_EorLogBy = p_Player.name
	NetEvents:Broadcast('BiaEorProfiles', self:EorPayload())
end

-- Old "Round end wait" row = total length of the Regular profile.
-- Changing it adjusts the Regular menu time (message + scoreboard unchanged).
function BiaManager:GetRoundEndWait()
	local s_R = self:GetEor('regular')
	return s_R.menu + s_R.msg + s_R.board
end

function BiaManager:OnGetRoundEnd(p_Player)
	self:OnGetEorProfiles(p_Player)
end

function BiaManager:OnSetRoundEnd(p_Player, p_Payload)
	local s_Total = tonumber(DecodePayload(p_Payload) or p_Payload)

	if s_Total == nil then
		return
	end

	local s_R = self:GetEor('regular')
	self:OnSetEorProfile(p_Player, { kind = 'regular', menu = s_Total - s_R.msg - s_R.board, msg = s_R.msg, board = s_R.board })
end

-- RCON compatibility with the standalone mod: vars.endOfRoundTime <menu> <msg> <board>
-- sets the Regular profile.
function BiaManager:RegisterEorRcon()
	local s_Ok = pcall(function()
		RCON:RegisterCommand('vars.endOfRoundTime', RemoteCommandFlag.RequiresLogin, function(p_Command, p_Args, p_LoggedIn)
			local s_R = self:GetEor('regular')

			if p_Args ~= nil and p_Args[1] ~= nil then
				local s_New = {
					menu = math.max(EOR_MIN, math.min(EOR_MAX, tonumber(p_Args[1]) or s_R.menu)),
					msg = math.max(EOR_MIN, math.min(EOR_MAX, tonumber(p_Args[2]) or s_R.msg)),
					board = math.max(EOR_MIN, math.min(EOR_MAX, tonumber(p_Args[3]) or s_R.board))
				}
				self.m_Eor.regular = s_New
				self:SetSetting('eor_regular', json.encode(s_New))

				if not self.m_RoundEnding then
					self:SendEor('regular')
				end

				NetEvents:Broadcast('BiaEorProfiles', self:EorPayload())
				s_R = s_New
			end

			return { 'OK', tostring(s_R.menu), tostring(s_R.msg), tostring(s_R.board) }
		end)
	end)

	if not s_Ok then
		print('BIA - EOR - vars.endOfRoundTime already registered (is the standalone EOR mod still installed? remove it)')
	end
end

function BiaManager:OnRoundOver(p_RoundTime, p_WinningTeam)
	self.m_RoundEnding = true
	self:BankRoundStats()
end

function BiaManager:OnLevelDestroy()
	-- maps ended by a hard switch never fire RoundOver
	self:BankRoundStats()
	-- back to Regular BEFORE the next level's EOR instances load, so an
	-- Instavote profile never leaks into the next map's natural round end
	self:SendEor('regular')
end

-- Endregion

-- Region per-round stats + rotation totals
-- Round stats: reset on every Level:Loaded. If the engine refuses the write
-- (read-only property), a per-player baseline makes the BANKED numbers
-- correct anyway (delta = now - baseline).
-- Rotation totals: banked once per map (RoundOver, or Level:Destroy for maps
-- skipped with Next Round). A rotation = as many maps as the queue holds, or
-- the whole map list without a queue; then the totals start over.

function BiaManager:StatsOf(p_Player)
	return tonumber(p_Player.kills) or 0, tonumber(p_Player.deaths) or 0, tonumber(p_Player.score) or 0
end

function BiaManager:StartRoundStats()
	self.m_StatsBanked = false
	self.m_StatBase = {}
	local s_ResetOk = true

	for _, l_Player in pairs(PlayerManager:GetPlayers()) do
		local s_Ok = pcall(function()
			l_Player.kills = 0
			l_Player.deaths = 0
			l_Player.score = 0
		end)

		if not s_Ok then
			s_ResetOk = false
		end

		local s_K, s_D, s_S = self:StatsOf(l_Player)
		self.m_StatBase[l_Player.name] = { k = s_K, d = s_D, s = s_S }
	end

	if not s_ResetOk and not self.m_ResetWarned then
		self.m_ResetWarned = true
		print('BIA - STATS - player kills/deaths/score are read-only here; rotation totals use per-map baselines')
	end

	-- rotation rollover
	local s_Played = tonumber(self:GetSetting('rot_maps_played')) or 0
	local s_Length = #self.m_Queue > 0 and #self.m_Queue or (self.m_MapCount > 0 and self.m_MapCount or 0)

	if s_Length > 0 and s_Played >= s_Length then
		self:ClearRotationStats()
		print('BIA - STATS - rotation complete (' .. s_Played .. ' maps), totals reset')
	end
end

function BiaManager:RoundDelta(p_Player)
	local s_K, s_D, s_S = self:StatsOf(p_Player)
	local s_Base = (self.m_StatBase or {})[p_Player.name]

	-- player joined mid-round: no baseline, everything is this round
	if s_Base == nil then
		return s_K, s_D, s_S
	end

	return math.max(0, s_K - s_Base.k), math.max(0, s_D - s_Base.d), math.max(0, s_S - s_Base.s)
end

-- a map counts as played only after ROT_MIN_MAP_SECONDS (pre-round alone doesn't)
function BiaManager:MapCounts()
	return self.m_LevelStart ~= nil and (SharedUtils:GetTime() - self.m_LevelStart) >= ROT_MIN_MAP_SECONDS
end

function BiaManager:BankRoundStats()
	if self.m_StatsBanked or self.m_StatBase == nil then
		return
	end

	self.m_StatsBanked = true

	-- too short (e.g. skipped right after pre-round): nothing from it counts
	if not self:MapCounts() then
		print('BIA - STATS - map lasted under ' .. ROT_MIN_MAP_SECONDS .. 's, not counted in rotation totals')
		return
	end

	local s_Counts = true

	if not self:OpenDb() then
		return
	end

	local s_InTx = SQL:Query('BEGIN TRANSACTION') and true or false
	local s_MapInc = s_Counts and 1 or 0

	for _, l_Player in pairs(PlayerManager:GetPlayers()) do
		local s_K, s_D, s_S = self:RoundDelta(l_Player)
		-- update-then-insert (works on any SQLite version, unlike ON CONFLICT)
		SQL:Query('UPDATE rotation_stats SET kills = kills + ?, deaths = deaths + ?, score = score + ?, maps = maps + ? WHERE name = ?',
			s_K, s_D, s_S, s_MapInc, l_Player.name)
		local s_Changed = SQL:Query('SELECT changes() AS n')

		if not (s_Changed and s_Changed[1] and tonumber(s_Changed[1]['n']) == 1) then
			SQL:Query('INSERT INTO rotation_stats (name, kills, deaths, score, maps) VALUES (?, ?, ?, ?, ?)', l_Player.name, s_K, s_D, s_S, s_MapInc)
		end
	end

	local s_Rows = SQL:Query("SELECT value FROM bia_settings WHERE key = 'rot_maps_played'")
	local s_Played = (s_Rows and s_Rows[1] and tonumber(s_Rows[1]['value']) or 0) + s_MapInc
	SQL:Query("INSERT OR REPLACE INTO bia_settings (key, value) VALUES ('rot_maps_played', ?)", tostring(s_Played))

	if s_InTx then
		SQL:Query('COMMIT')
	end

	SQL:Close()
	print('BIA - STATS - map banked into rotation totals (' .. s_Played .. ' map(s) this rotation' .. (s_Counts and '' or ', this one too short to count') .. ')')
end

function BiaManager:ClearRotationStats()
	if self:OpenDb() then
		SQL:Query('DELETE FROM rotation_stats')
		SQL:Query("INSERT OR REPLACE INTO bia_settings (key, value) VALUES ('rot_maps_played', '0')")
		SQL:Close()
	end
end

-- totals + the live (not yet banked) current map, sorted by score
function BiaManager:OnGetRotationStats(p_Player)
	local s_ByName = {}
	local s_Played = 0

	if self:OpenDb() then
		local s_Rows = SQL:Query('SELECT * FROM rotation_stats')

		if s_Rows then
			for _, l_Row in pairs(s_Rows) do
				local s_Name = tostring(l_Row['name'])
				s_ByName[s_Name] = {
					name = s_Name,
					k = tonumber(l_Row['kills']) or 0,
					d = tonumber(l_Row['deaths']) or 0,
					s = tonumber(l_Row['score']) or 0,
					m = tonumber(l_Row['maps']) or 0
				}
			end
		end

		local s_P = SQL:Query("SELECT value FROM bia_settings WHERE key = 'rot_maps_played'")
		s_Played = s_P and s_P[1] and tonumber(s_P[1]['value']) or 0
		SQL:Close()
	end

	-- the running map only shows up once it's long enough to count
	local s_Live = not self.m_StatsBanked and self:MapCounts()
	local s_LiveMap = s_Live and 1 or 0

	for _, l_Player in pairs(PlayerManager:GetPlayers()) do
		local s_E = s_ByName[l_Player.name]

		if s_E == nil then
			s_E = { name = l_Player.name, k = 0, d = 0, s = 0, m = 0 }
			s_ByName[l_Player.name] = s_E
		end

		s_E.online = true

		if s_Live then
			local s_K, s_D, s_S = self:RoundDelta(l_Player)
			s_E.k = s_E.k + s_K
			s_E.d = s_E.d + s_D
			s_E.s = s_E.s + s_S
			s_E.m = s_E.m + s_LiveMap
		end
	end

	local s_List = {}

	for _, l_E in pairs(s_ByName) do
		table.insert(s_List, l_E)
	end

	table.sort(s_List, function(a, b)
		return a.s > b.s
	end)

	while #s_List > 128 do
		table.remove(s_List)
	end

	local s_Length = #self.m_Queue > 0 and #self.m_Queue or self.m_MapCount

	NetEvents:SendTo('BiaRotationStats', p_Player, {
		played = s_Played + s_LiveMap,
		length = s_Length,
		rows = s_List
	})
end

function BiaManager:OnResetRotationStats(p_Player)
	if not self:IsAllowed(p_Player.name, 'any') then
		return
	end

	self:ClearRotationStats()
	-- the current map counts from now
	self:StartRoundStats()
	self:Log(p_Player.name, p_Player.name .. ' reset the rotation stats')
	self:OnGetRotationStats(p_Player)
end

-- Endregion

return BiaManager()

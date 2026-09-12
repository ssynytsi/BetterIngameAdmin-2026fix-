---@class BiaManager
-- Persistent map queue + ban and admin list management.
-- Drop in ext/Server and add require('BiaManager') to ext/Server/__init__.lua.
BiaManager = class 'BiaManager'

---@type GameAdmin
local m_GameAdmin = require('GameAdmin')
---@type ServerOwner
local m_ServerOwner = require('ServerOwner')

function BiaManager:__init()
	self.m_QueueRandom = false
	self.m_Queue = {}
	self.m_Dirty = false

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

	Events:Subscribe('Level:Loaded', self, self.OnLevelLoaded)
	Events:Subscribe('Player:Authenticated', self, self.OnPlayerAuthenticated)
	Events:Subscribe('Engine:Update', self, self.OnEngineUpdate)

	self.m_MapVote = nil
	self.m_VoteTick = 0
	self.m_WarmupUntil = 0
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
	end

	return false
end

-- Region mod.db

function BiaManager:EnsureTable()
	if not SQL:Open() then
		print('BIA - QUEUE - SQL:Open failed')
		return false
	end

	local s_Query = [[
		CREATE TABLE IF NOT EXISTS map_queue (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			position INTEGER,
			map_index INTEGER,
			map_name TEXT,
			map_mode TEXT,
			is_random BOOLEAN
		)
	]]

	if not SQL:Query(s_Query) then
		print('BIA - QUEUE - Failed to create table: ' .. tostring(SQL:Error()))
		SQL:Close()
		return false
	end

	return true
end

function BiaManager:LoadQueue()
	if not self:EnsureTable() then
		return
	end

	local s_Results = SQL:Query('SELECT * FROM map_queue ORDER BY position ASC')
	SQL:Close()

	if not s_Results then
		return
	end

	self.m_Queue = {}
	self.m_QueueRandom = false

	for _, l_Row in pairs(s_Results) do
		if l_Row["is_random"] == 1 or l_Row["is_random"] == true then
			self.m_QueueRandom = true
		end

		local s_Index = tonumber(l_Row["map_index"])
		if s_Index ~= nil then
			table.insert(self.m_Queue, {
				index = s_Index,
				name = tostring(l_Row["map_name"] or ""),
				mode = tostring(l_Row["map_mode"] or "")
			})
		end
	end

	print("BIA - QUEUE - Loaded " .. #self.m_Queue .. " queued map(s) from mod.db (random=" .. tostring(self.m_QueueRandom) .. ")")
end

function BiaManager:SaveQueue()
	if not self:EnsureTable() then
		return false
	end

	if not SQL:Query('DELETE FROM map_queue') then
		print('BIA - QUEUE - Failed to clear table: ' .. tostring(SQL:Error()))
		SQL:Close()
		return false
	end

	local s_RandomFlag = self.m_QueueRandom and 1 or 0

	for i, l_Entry in ipairs(self.m_Queue) do
		local s_Query = 'INSERT INTO map_queue (position, map_index, map_name, map_mode, is_random) VALUES (?, ?, ?, ?, ?)'
		local s_Index = tonumber(l_Entry.index) or 0
		local s_Name = tostring(l_Entry.name or "")
		local s_Mode = tostring(l_Entry.mode or "")

		if not SQL:Query(s_Query, i, s_Index, s_Name, s_Mode, s_RandomFlag) then
			print('BIA - QUEUE - Failed to insert row ' .. i .. ': ' .. tostring(SQL:Error()))
			SQL:Close()
			return false
		end
	end

	SQL:Close()
	self.m_Dirty = false
	print("BIA - QUEUE - Saved " .. #self.m_Queue .. " map(s) to mod.db")
	return true
end

-- Endregion

function BiaManager:BroadcastQueue()
	local s_Payload = { random = self.m_QueueRandom, maps = self.m_Queue }
	NetEvents:Broadcast('MapQueue', s_Payload)
end

function BiaManager:BroadcastMapRotation()
	-- Mirror Admin:OnGetMapRotation so Server Info / Map Rotation tabs refresh.
	local s_Args = {}
	local s_Arg = RCON:SendCommand('mapList.list')

	if s_Arg ~= nil and s_Arg[2] ~= nil then
		table.remove(s_Arg, 1)
		table.insert(s_Args, s_Arg)
	else
		table.insert(s_Args, " ")
	end

	s_Arg = RCON:SendCommand('mapList.getMapIndices')

	if s_Arg ~= nil and s_Arg[2] ~= nil then
		table.remove(s_Arg, 1)
		table.insert(s_Args, s_Arg)
	else
		table.insert(s_Args, " ")
	end

	NetEvents:Broadcast('MapRotation', s_Args)
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
	s_Index = s_Index - 1
	RCON:SendCommand('mapList.setNextMapIndex', { tostring(s_Index) })
	print("BIA - QUEUE - Next map set to index " .. s_Index .. " (" .. tostring(self.m_Queue[1].name) .. " / " .. tostring(self.m_Queue[1].mode) .. ")")
	return true
end

function BiaManager:OnSaveMapQueue(p_Player, p_Payload)
	if not self:IsAllowed(p_Player.name, 'map') then
		print("BIA - QUEUE - Save denied for " .. p_Player.name)
		return
	end

	local s_Data = nil

	if type(p_Payload) == 'string' then
		s_Data = json.decode(p_Payload)
	elseif type(p_Payload) == 'table' then
		s_Data = p_Payload
	end

	if s_Data == nil then
		print("BIA - QUEUE - SaveMapQueue: invalid payload from " .. p_Player.name)
		return
	end

	self.m_QueueRandom = s_Data.random == true
	self.m_Queue = {}

	if type(s_Data.maps) == 'table' then
		for _, l_Entry in ipairs(s_Data.maps) do
			local s_Index = tonumber(l_Entry.index)
			if s_Index ~= nil then
				table.insert(self.m_Queue, {
					index = s_Index,
					name = tostring(l_Entry.name or ("MAP " .. s_Index)),
					mode = tostring(l_Entry.mode or "")
				})
			end
		end
	end

	local s_Ok = self:SaveQueue()

	-- Critical: push the new head to the engine immediately so Server Info
	-- "next map" and the rotation markers update without waiting for Level:Loaded.
	if #self.m_Queue > 0 then
		self:ApplyNextMap()
		self:BroadcastMapRotation()
	end

	self:BroadcastQueue()

	-- Silent save: no popup (autosave fires often; clicking OK every time is noise).
	if not s_Ok then
		print("BIA - QUEUE - Save FAILED for " .. p_Player.name)
	else
		print("BIA - QUEUE - " .. p_Player.name .. " saved queue (" .. #self.m_Queue .. " maps, random=" .. tostring(self.m_QueueRandom) .. ")")
	end
end

function BiaManager:OnGetMapQueue(p_Player)
	NetEvents:SendTo('MapQueue', p_Player, { random = self.m_QueueRandom, maps = self.m_Queue })
end

function BiaManager:OnPlayerAuthenticated(p_Player)
	-- Push stored queue to joining players so the WebUI is correct after a reload.
	if #self.m_Queue > 0 or self.m_QueueRandom then
		NetEvents:SendTo('MapQueue', p_Player, { random = self.m_QueueRandom, maps = self.m_Queue })
	end
end

-- The WebUI reloads on every level change, so client-side JS state cannot be
-- trusted to advance the queue. The server does it: rotate the map that just
-- played to the back, persist, tell the engine what is next, and push the new
-- order to every client.
function BiaManager:OnLevelLoaded(p_LevelName, p_GameMode, p_Round, p_RoundsPerMap)
	-- Pre-round / warm-up is ~10s; block map votes until it ends so the UI
	-- is not left half-dead when the live round starts mid-vote.
	self.m_WarmupUntil = SharedUtils:GetTime() + 12
	self:ClearMapVote()
	self:LoadQueue()

	if #self.m_Queue > 0 then
		local s_Played = table.remove(self.m_Queue, 1)
		table.insert(self.m_Queue, s_Played)

		if self.m_QueueRandom and #self.m_Queue > 1 then
			local s_Pick = MathUtils:GetRandomInt(1, #self.m_Queue)
			local s_Chosen = table.remove(self.m_Queue, s_Pick)
			table.insert(self.m_Queue, 1, s_Chosen)
		end

		self:SaveQueue()
		self:ApplyNextMap()
		self:BroadcastMapRotation()
	end

	self:BroadcastQueue()
end

function BiaManager:OnForceNextFromQueue(p_Player)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	if #self.m_Queue == 0 then
		local s_Messages = { "Queue empty.", "Add maps to the queue first." }
		NetEvents:SendTo('PopupResponse', p_Player, s_Messages)
		return
	end

	-- Rotate current head to the back, apply the new head, run next round.
	local s_Played = table.remove(self.m_Queue, 1)
	table.insert(self.m_Queue, s_Played)

	if self.m_QueueRandom and #self.m_Queue > 1 then
		local s_Pick = MathUtils:GetRandomInt(1, #self.m_Queue)
		local s_Chosen = table.remove(self.m_Queue, s_Pick)
		table.insert(self.m_Queue, 1, s_Chosen)
	end

	self:SaveQueue()
	self:ApplyNextMap()
	self:BroadcastMapRotation()
	self:BroadcastQueue()

	RCON:SendCommand('mapList.runNextRound')
	print("BIA - QUEUE - " .. p_Player.name .. " forced next from queue -> " .. tostring(self.m_Queue[1] and self.m_Queue[1].name))

	local s_Messages = {
		"Next map forced.",
		"Running next: " .. tostring(self.m_Queue[1] and self.m_Queue[1].name or "?")
	}
	NetEvents:SendTo('PopupResponse', p_Player, s_Messages)
end

function BiaManager:OnAnnounceQueue(p_Player)
	if not self:IsAllowed(p_Player.name, 'map') then
		return
	end

	if #self.m_Queue == 0 then
		RCON:SendCommand('admin.say', { "Map queue is empty.", "all" })
		return
	end

	local s_Parts = {}
	local s_Limit = math.min(#self.m_Queue, 5)
	for i = 1, s_Limit do
		table.insert(s_Parts, i .. ". " .. tostring(self.m_Queue[i].name))
	end
	if #self.m_Queue > 5 then
		table.insert(s_Parts, "... +" .. (#self.m_Queue - 5) .. " more")
	end

	local s_Msg = "Next maps: " .. table.concat(s_Parts, " | ")
	if self.m_QueueRandom then
		s_Msg = s_Msg .. " (random mode)"
	end
	RCON:SendCommand('admin.say', { s_Msg, "all" })
	print("BIA - QUEUE - " .. p_Player.name .. " announced queue")
end

-- Region Ban list

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
		return string.format("%.0f min", s_Minutes)
	end

	local s_Hours = s_Minutes / 60

	if s_Hours < 24 then
		return string.format("%.1f hrs", s_Hours)
	end

	return string.format("%.1f days", s_Hours / 24)
end

function BiaManager:OnGetBanList(p_Player)
	if not self:IsAllowed(p_Player.name, 'ban') then
		return
	end

	local s_Response = RCON:SendCommand('banList.list')
	local s_Bans = {}

	if s_Response == nil or s_Response[1] ~= 'OK' then
		NetEvents:SendTo('BanList', p_Player, s_Bans)
		return
	end

	local i = 2

	while s_Response[i] ~= nil and #s_Bans < 50 do
		local s_IdType = s_Response[i]
		local s_Id = s_Response[i + 1]
		local s_BanType = s_Response[i + 2]
		local s_Value = s_Response[i + 3]
		local s_Reason = s_Response[i + 4]

		if s_Id == nil then
			break
		end

		if s_IdType == 'name' or s_IdType == 'guid' then
			table.insert(s_Bans, {
				name = s_Id,
				idType = s_IdType,
				reason = self:FormatBanDuration(s_BanType, s_Value) .. ' - ' .. (s_Reason or 'no reason')
			})
		end

		i = i + 5
	end

	NetEvents:SendTo('BanList', p_Player, s_Bans)
end

function BiaManager:OnUnbanPlayer(p_Player, p_Name)
	if not self:IsAllowed(p_Player.name, 'ban') then
		return
	end

	RCON:SendCommand('banList.remove', { 'name', p_Name })
	RCON:SendCommand('banList.save')
	print("BIA - UNBAN - " .. p_Player.name .. " unbanned " .. tostring(p_Name))

	local s_Messages = {}
	s_Messages[1] = "Unbanned."
	s_Messages[2] = tostring(p_Name) .. " has been removed from the ban list."
	NetEvents:SendTo('PopupResponse', p_Player, s_Messages)

	-- Refresh list for the admin
	self:OnGetBanList(p_Player)
end

-- Endregion

-- Region Admin list

function BiaManager:OnGetAdminList(p_Player)
	if not self:IsAllowed(p_Player.name, 'admin') then
		return
	end

	local s_Response = RCON:SendCommand('gameAdmin.list')
	local s_Admins = {}

	local s_OwnerResponse = RCON:SendCommand('vars.serverOwner')

	if s_OwnerResponse ~= nil and s_OwnerResponse[2] ~= nil and s_OwnerResponse[2] ~= 'OwnerNotSet' then
		table.insert(s_Admins, { name = s_OwnerResponse[2], rights = 'server owner (all rights)' })
	end

	if s_Response == nil or s_Response[1] ~= 'OK' then
		NetEvents:SendTo('AdminList', p_Player, s_Admins)
		return
	end

	local i = 2

	while s_Response[i] ~= nil do
		local s_Name = s_Response[i]
		local s_Count = tonumber(s_Response[i + 1])

		if s_Count == nil then
			break
		end

		table.insert(s_Admins, { name = s_Name, rights = s_Count .. ' right(s)' })
		i = i + 2 + s_Count
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
		local s_Messages = { "That is a bot.", p_Name .. " cannot be promoted." }
		NetEvents:SendTo('PopupResponse', p_Player, s_Messages)
		return
	end

	-- name + 13 rights (order required by gameAdmin)
	local s_Args = {
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
	}

	RCON:SendCommand('gameAdmin.add', s_Args)
	RCON:SendCommand('gameAdmin.save')
	print("BIA - ADMIN ADD - " .. p_Player.name .. " promoted " .. p_Name)

	local s_Messages = {}
	s_Messages[1] = "Admin added."
	s_Messages[2] = p_Name .. " is now an admin with move, kill and kick rights."
	NetEvents:SendTo('PopupResponse', p_Player, s_Messages)

	self:OnGetAdminList(p_Player)
end

function BiaManager:OnRemoveAdmin(p_Player, p_Name)
	if not self:IsAllowed(p_Player.name, 'admin') then
		return
	end

	RCON:SendCommand('gameAdmin.remove', { p_Name })
	RCON:SendCommand('gameAdmin.save')
	print("BIA - ADMIN REMOVE - " .. p_Player.name .. " removed " .. tostring(p_Name))

	self:OnGetAdminList(p_Player)
end

-- Endregion


-- Region Map vote (vote-for-next-map from queue)

function BiaManager:ClearMapVote(p_Silent)
	if self.m_MapVote ~= nil and not p_Silent then
		NetEvents:Broadcast('MapVoteEnd', { success = false, name = self.m_MapVote.name or '', cancelled = true })
	end
	self.m_MapVote = nil
end

function BiaManager:OnStartMapVote(p_Player, p_Payload)
	if SharedUtils:GetTime() < (self.m_WarmupUntil or 0) then
		NetEvents:SendTo('PopupResponse', p_Player, {
			"Can't vote in pre-round.",
			"Wait until the round has started, then try again."
		})
		return
	end

	if self.m_MapVote ~= nil then
		NetEvents:SendTo('PopupResponse', p_Player, { "Vote in progress.", "A map vote is already running." })
		return
	end

	local s_Data = nil
	if type(p_Payload) == 'string' then
		s_Data = json.decode(p_Payload)
	elseif type(p_Payload) == 'table' then
		s_Data = p_Payload
	end

	if s_Data == nil then
		return
	end

	local s_Index = tonumber(s_Data.index)
	local s_Name = tostring(s_Data.name or "Map")
	local s_Mode = tostring(s_Data.mode or "")

	if s_Index == nil then
		return
	end

	-- Duration / participation mirror typical BIA vote defaults
	local s_Duration = 30
	local s_Players = PlayerManager:GetPlayers()
	local s_PlayerCount = 0
	if s_Players ~= nil then
		for _ in pairs(s_Players) do
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
		endsAt = SharedUtils:GetTime() + s_Duration,
		needed = math.max(1, math.ceil(s_PlayerCount * 0.5))
	}

	NetEvents:Broadcast('MapVoteStart', {
		name = s_Name,
		mode = s_Mode,
		seconds = s_Duration,
		yes = 1,
		no = 0
	})

	RCON:SendCommand('admin.say', {
		p_Player.name .. " started a vote for next map: " .. s_Name .. (s_Mode ~= "" and (" (" .. s_Mode .. ")") or ""),
		"all"
	})
	print("BIA - MAPVOTE - Started by " .. p_Player.name .. " for " .. s_Name)
end

function BiaManager:OnMapVoteYes(p_Player)
	if self.m_MapVote == nil then
		return
	end

	local s_Name = p_Player.name
	if self.m_MapVote.yes[s_Name] then
		return
	end
	if self.m_MapVote.no[s_Name] then
		self.m_MapVote.no[s_Name] = nil
		self.m_MapVote.noCount = math.max(0, self.m_MapVote.noCount - 1)
	end
	self.m_MapVote.yes[s_Name] = true
	self.m_MapVote.yesCount = self.m_MapVote.yesCount + 1

	NetEvents:Broadcast('MapVoteUpdate', {
		yes = self.m_MapVote.yesCount,
		no = self.m_MapVote.noCount
	})

	self:TryResolveMapVote()
end

function BiaManager:OnMapVoteNo(p_Player)
	if self.m_MapVote == nil then
		return
	end

	local s_Name = p_Player.name
	if self.m_MapVote.no[s_Name] then
		return
	end
	if self.m_MapVote.yes[s_Name] then
		self.m_MapVote.yes[s_Name] = nil
		self.m_MapVote.yesCount = math.max(0, self.m_MapVote.yesCount - 1)
	end
	self.m_MapVote.no[s_Name] = true
	self.m_MapVote.noCount = self.m_MapVote.noCount + 1

	NetEvents:Broadcast('MapVoteUpdate', {
		yes = self.m_MapVote.yesCount,
		no = self.m_MapVote.noCount
	})
end

function BiaManager:TryResolveMapVote(p_ForceExpire)
	if self.m_MapVote == nil then
		return
	end

	local s_Vote = self.m_MapVote
	local s_Expired = p_ForceExpire or (SharedUtils:GetTime() >= s_Vote.endsAt)
	local s_Passed = s_Vote.yesCount >= s_Vote.needed

	if not s_Expired and not s_Passed then
		return
	end

	local s_Success = s_Vote.yesCount > s_Vote.noCount and s_Vote.yesCount >= 1

	if s_Success then
		-- Promote voted map to queue head (or insert if not present)
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
			"Map vote passed: " .. s_Vote.name .. " is next (" .. s_Vote.yesCount .. "Y / " .. s_Vote.noCount .. "N).",
			"all"
		})
		print("BIA - MAPVOTE - PASSED " .. s_Vote.name)
	else
		RCON:SendCommand('admin.say', {
			"Map vote failed for " .. s_Vote.name .. " (" .. s_Vote.yesCount .. "Y / " .. s_Vote.noCount .. "N).",
			"all"
		})
		print("BIA - MAPVOTE - FAILED " .. s_Vote.name)
	end

	NetEvents:Broadcast('MapVoteEnd', { success = s_Success, name = s_Vote.name })
	self:ClearMapVote()
end

function BiaManager:OnEngineUpdate(p_Delta)
	if self.m_MapVote == nil then
		return
	end
	-- Throttle checks ~every 0.5s
	self.m_VoteTick = (self.m_VoteTick or 0) + p_Delta
	if self.m_VoteTick < 0.5 then
		return
	end
	self.m_VoteTick = 0

	-- Level transition / warm-up restarted under an active vote → cancel cleanly
	if SharedUtils:GetTime() < (self.m_WarmupUntil or 0) then
		print("BIA - MAPVOTE - Cancelled (pre-round / level load)")
		self:ClearMapVote()
		return
	end

	if SharedUtils:GetTime() >= self.m_MapVote.endsAt then
		self:TryResolveMapVote(true)
	end
end

-- Endregion


return BiaManager()

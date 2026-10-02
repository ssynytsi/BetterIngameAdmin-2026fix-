---@class Admin
Admin = class 'Admin'

---@type ModSettings
local m_ModSettings = require('ModSettings')
---@type GameAdmin
local m_GameAdmin = require('GameAdmin')
---@type GeneralSettings
local m_GeneralSettings = require('GeneralSettings')
---@type ServerOwner
local m_ServerOwner = require('ServerOwner')

local NO_RIGHTS = "Sorry, you are no admin or at least don't have the required abilities to do this action."

local function Popup(p_Player, p_Title, p_Text)
	NetEvents:SendTo('PopupResponse', p_Player, { p_Title, p_Text })
end

local function HasText(p_Value)
	return p_Value ~= nil and p_Value ~= ""
end

-- Console + persistent admin log (BiaManager listens to BIA:Log)
local function Log(p_Admin, p_Text)
	print("ADMIN - " .. p_Text)
	Events:Dispatch('BIA:Log', p_Admin, p_Text)
end

function Admin:__init()
	-- actions for players
	NetEvents:Subscribe('MovePlayer', self, self.OnMovePlayer)
	NetEvents:Subscribe('KillPlayer', self, self.OnKillPlayer)
	NetEvents:Subscribe('KickPlayer', self, self.OnKickPlayer)
	NetEvents:Subscribe('TBanPlayer', self, self.OnTBanPlayer)
	NetEvents:Subscribe('BanPlayer', self, self.OnBanPlayer)
	NetEvents:Subscribe('DeleteAdminRights', self, self.OnDeleteAdminRights)
	NetEvents:Subscribe('DeleteAndSaveAdminRights', self, self.OnDeleteAndSaveAdminRights)
	NetEvents:Subscribe('UpdateAdminRights', self, self.OnUpdateAdminRights)
	NetEvents:Subscribe('UpdateAndSaveAdminRights', self, self.OnUpdateAndSaveAdminRights)
	NetEvents:Subscribe('GetAdminRightsOfPlayer', self, self.OnGetAdminRightsOfPlayer)

	-- Map Rotation
	NetEvents:Subscribe('SetNextMap', self, self.OnSetNextMap)
	NetEvents:Subscribe('RunNextRound', self, self.OnRunNextRound)
	NetEvents:Subscribe('RestartRound', self, self.OnRestartRound)

	-- Server Setup
	NetEvents:Subscribe('GetServerSetupSettings', self, self.OnGetServerSetupSettings)
	NetEvents:Subscribe('SaveServerSetupSettings', self, self.OnSaveServerSetupSettings)

	-- Manage Presets
	NetEvents:Subscribe('ManagePresets', self, self.OnManagePresets)

	-- Manage ModSettings
	NetEvents:Subscribe('ResetModSettings', self, self.OnResetModSettings)
	NetEvents:Subscribe('ResetAndSaveModSettings', self, self.OnResetAndSaveModSettings)
	NetEvents:Subscribe('ApplyModSettings', self, self.OnApplyModSettings)
	NetEvents:Subscribe('SaveModSettings', self, self.OnSaveModSettings)
end

-- Region helpers

-- p_Check is a GameAdmin method name, e.g. 'CanKickPlayers'. The server owner
-- is not in gameAdmin's list, so the owner check has to come first.
function Admin:Allowed(p_Player, p_Check, p_Tag, p_Silent)
	if m_ServerOwner:IsOwner(p_Player.name) then
		return true
	end

	local s_Fn = m_GameAdmin[p_Check]

	if s_Fn ~= nil and s_Fn(m_GameAdmin, p_Player.name) then
		return true
	end

	if not p_Silent then
		Popup(p_Player, "Error.", NO_RIGHTS)
	end

	print("ADMIN " .. p_Tag .. " - Error Player " .. p_Player.name .. " is no admin")
	return false
end

-- Admins and the owner are protected from other admins. The owner can still
-- act on admins (otherwise a rogue admin could never be kicked in-game).
function Admin:IsProtected(p_Player, p_TargetName, p_Tag)
	if m_ServerOwner:IsOwner(p_TargetName) then
		Popup(p_Player, "Error.", "Sorry, that player is protected.")
		print("ADMIN " .. p_Tag .. " - Error Player " .. tostring(p_TargetName) .. " is protected")
		return true
	end

	if m_GameAdmin:IsAdmin(p_TargetName) and not m_ServerOwner:IsOwner(p_Player.name) then
		Popup(p_Player, "Error.", "Sorry, that player is protected.")
		print("ADMIN " .. p_Tag .. " - Error Player " .. tostring(p_TargetName) .. " is protected")
		return true
	end

	return false
end

function Admin:FindTarget(p_Player, p_Name, p_Tag)
	local s_Target = PlayerManager:GetPlayerByName(tostring(p_Name))

	if s_Target == nil then
		Popup(p_Player, "Error.", "Sorry, we couldn't find the player.")
		print("ADMIN " .. p_Tag .. " - Error Admin " .. p_Player.name .. " targeted " .. tostring(p_Name) .. " but we couldn't find him.")
	end

	return s_Target
end

-- Endregion

-- Region actions for players

function Admin:OnMovePlayer(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanMovePlayers', 'MOVE') then
		return
	end

	local s_Target = self:FindTarget(p_Player, p_Args[1], 'MOVE')

	if s_Target == nil then
		return
	end

	RCON:SendCommand('admin.movePlayer', { s_Target.name, tostring(p_Args[2]), tostring(p_Args[3]), "true" })
	RCON:SendCommand('squad.private', { tostring(s_Target.teamId), tostring(s_Target.squadId), "false" })

	local s_Reason = HasText(p_Args[4]) and (" Reason: " .. p_Args[4]) or ""
	Popup(s_Target, "Moved by admin.", "You got moved by an admin." .. s_Reason)
	Popup(p_Player, "Move confirmed.", "You moved the player " .. s_Target.name .. " successfully." .. s_Reason)
	Log(p_Player.name, p_Player.name .. " moved " .. s_Target.name .. " to team " .. tostring(p_Args[2]) .. " squad " .. tostring(p_Args[3]) .. "." .. s_Reason)
end

function Admin:OnKillPlayer(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanKillPlayers', 'KILL') then
		return
	end

	local s_Target = self:FindTarget(p_Player, p_Args[1], 'KILL')

	if s_Target == nil then
		return
	end

	if s_Target.alive == true then
		RCON:SendCommand('admin.killPlayer', { s_Target.name })
	elseif s_Target.corpse ~= nil and s_Target.corpse.isDead == false then
		-- was p_Player.corpse (the ADMIN's corpse), so downed targets never got finished
		s_Target.corpse:ForceDead()
	else
		Popup(p_Player, "Error.", "The player " .. s_Target.name .. " is already dead.")
		return
	end

	local s_Reason = ""

	if HasText(p_Args[2]) then
		RCON:SendCommand('admin.say', { "Reason for kill: " .. p_Args[2], "player", s_Target.name })
		s_Reason = " Reason: " .. p_Args[2]
	end

	Log(p_Player.name, p_Player.name .. " killed " .. s_Target.name .. "." .. s_Reason)
end

function Admin:OnKickPlayer(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanKickPlayers', 'KICK') or self:IsProtected(p_Player, p_Args[1], 'KICK') then
		return
	end

	local s_Target = self:FindTarget(p_Player, p_Args[1], 'KICK')

	if s_Target == nil then
		return
	end

	local s_Name = s_Target.name

	if HasText(p_Args[2]) then
		s_Target:Kick(p_Args[2] .. " (" .. p_Player.name .. ")")
		Log(p_Player.name, p_Player.name .. " kicked " .. s_Name .. ". Reason: " .. p_Args[2])
	else
		s_Target:Kick("Kicked by " .. p_Player.name)
		Log(p_Player.name, p_Player.name .. " kicked " .. s_Name .. ".")
	end

	Popup(p_Player, "Kick confirmed.", "You kicked the player " .. s_Name .. " successfully.")
end

function Admin:OnTBanPlayer(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanTemporaryBanPlayers', 'TBAN') or self:IsProtected(p_Player, p_Args[1], 'TBAN') then
		return
	end

	local s_Target = self:FindTarget(p_Player, p_Args[1], 'TBAN')

	if s_Target == nil then
		return
	end

	-- The WebUI sends "" when the duration box is blank (not nil)
	local s_Minutes = tonumber(p_Args[2])

	if s_Minutes == nil or s_Minutes <= 0 then
		s_Minutes = 60
	end

	s_Minutes = math.floor(s_Minutes)
	local s_Name = s_Target.name

	if HasText(p_Args[3]) then
		s_Target:BanTemporarily(s_Minutes * 60, p_Args[3] .. " (" .. p_Player.name .. ") " .. s_Minutes .. " minutes")
		Log(p_Player.name, p_Player.name .. " temp-banned " .. s_Name .. " for " .. s_Minutes .. " min. Reason: " .. p_Args[3])
	else
		s_Target:BanTemporarily(s_Minutes * 60, "Temporarily banned by " .. p_Player.name .. " for " .. s_Minutes .. " minutes")
		Log(p_Player.name, p_Player.name .. " temp-banned " .. s_Name .. " for " .. s_Minutes .. " min.")
	end

	Popup(p_Player, "Ban confirmed.", "You banned the player " .. s_Name .. " successfully for " .. s_Minutes .. " minutes.")
end

function Admin:OnBanPlayer(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanPermanentlyBanPlayers', 'BAN') or self:IsProtected(p_Player, p_Args[1], 'BAN') then
		return
	end

	local s_Target = self:FindTarget(p_Player, p_Args[1], 'BAN')

	if s_Target == nil then
		return
	end

	local s_Name = s_Target.name

	if HasText(p_Args[2]) then
		s_Target:Ban(p_Args[2] .. " (" .. p_Player.name .. ")")
		Log(p_Player.name, p_Player.name .. " banned " .. s_Name .. ". Reason: " .. p_Args[2])
	else
		s_Target:Ban("Banned by " .. p_Player.name)
		Log(p_Player.name, p_Player.name .. " banned " .. s_Name .. ".")
	end

	Popup(p_Player, "Ban confirmed.", "You banned the player " .. s_Name .. " successfully.")
end

function Admin:OnDeleteAdminRights(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanEditGameAdminList', 'ADMIN RIGHTS DELETE') then
		return
	end

	RCON:SendCommand('gameAdmin.remove', p_Args)
	Log(p_Player.name, p_Player.name .. " removed admin rights of " .. tostring(p_Args[1]))
end

function Admin:OnDeleteAndSaveAdminRights(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanEditGameAdminList', 'ADMIN RIGHTS DELETE+SAVE') then
		return
	end

	RCON:SendCommand('gameAdmin.remove', p_Args)
	RCON:SendCommand('gameAdmin.save')
	Log(p_Player.name, p_Player.name .. " removed (saved) admin rights of " .. tostring(p_Args[1]))
end

function Admin:OnUpdateAdminRights(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanEditGameAdminList', 'ADMIN RIGHTS UPDATE') then
		return
	end

	RCON:SendCommand('gameAdmin.add', p_Args)
	Log(p_Player.name, p_Player.name .. " updated admin rights of " .. tostring(p_Args[1]))
end

function Admin:OnUpdateAndSaveAdminRights(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanEditGameAdminList', 'ADMIN RIGHTS UPDATE+SAVE') then
		return
	end

	RCON:SendCommand('gameAdmin.add', p_Args)
	RCON:SendCommand('gameAdmin.save')
	Log(p_Player.name, p_Player.name .. " updated (saved) admin rights of " .. tostring(p_Args[1]))
end

function Admin:OnGetAdminRightsOfPlayer(p_Player, p_PlayerName)
	local s_Target = PlayerManager:GetPlayerByName(tostring(p_PlayerName))

	if s_Target == nil then
		Popup(p_Player, "Error.", "Sorry, we couldn't find the player.")
		return
	end

	NetEvents:SendTo('AdminRightsOfPlayer', p_Player, m_GameAdmin:GetAdminRightsOfPlayer(s_Target.name))
end

-- Endregion

-- Region Map Rotation

-- Kept for anything still calling it; the paged fetch lives in BiaManager.
function Admin:OnGetMapRotation()
	require('BiaManager'):BroadcastMapRotation()
end

function Admin:OnSetNextMap(p_Player, p_MapIndex)
	if not self:Allowed(p_Player, 'CanUseMapFunctions', 'SET NEXT MAP', true) then
		return
	end

	-- WebUI list is 1-based, mapList.setNextMapIndex is 0-based.
	local s_Index = tonumber(p_MapIndex)

	if s_Index == nil or s_Index < 1 then
		print("ADMIN - SET NEXT MAP - bad index " .. tostring(p_MapIndex) .. " from " .. p_Player.name)
		return
	end

	RCON:SendCommand('mapList.setNextMapIndex', { tostring(s_Index - 1) })
	Log(p_Player.name, p_Player.name .. " set next map index to " .. (s_Index - 1))
	self:OnGetMapRotation()
end

function Admin:OnRunNextRound(p_Player)
	if not self:Allowed(p_Player, 'CanUseMapFunctions', 'RUN NEXT ROUND', true) then
		return
	end

	RCON:SendCommand('mapList.runNextRound')
	Log(p_Player.name, p_Player.name .. " ran the next round")
end

function Admin:OnRestartRound(p_Player)
	if not self:Allowed(p_Player, 'CanUseMapFunctions', 'RESTART ROUND', true) then
		return
	end

	RCON:SendCommand('mapList.restartRound')
	Log(p_Player.name, p_Player.name .. " restarted the round")
end

-- Endregion

-- Region Server Setup

function Admin:OnGetServerSetupSettings(p_Player)
	-- was unguarded: any player could read the game password
	if not self:Allowed(p_Player, 'CanAlterServerSettings', 'GET SERVER SETUP', true) then
		return
	end

	local s_Args = {}

	for _, l_Var in ipairs({ 'vars.serverName', 'vars.serverDescription', 'vars.serverMessage', 'vars.gamePassword' }) do
		local s_Arg = RCON:SendCommand(l_Var)

		if s_Arg ~= nil and s_Arg[2] ~= nil then
			table.remove(s_Arg, 1)
			table.insert(s_Args, s_Arg)
		else
			table.insert(s_Args, " ")
		end
	end

	NetEvents:SendTo('ServerSetupSettings', p_Player, s_Args)
end

function Admin:OnSaveServerSetupSettings(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanAlterServerSettings', 'SAVE SERVER SETUP', true) then
		return
	end

	m_GeneralSettings:OnSaveServerSetupSettings(p_Args)
	Log(p_Player.name, p_Player.name .. " updated server name/description/message/password")
end

-- Endregion

-- Region Manage Presets

function Admin:OnManagePresets(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanAlterServerSettings', 'MANAGE PRESETS', true) then
		return
	end

	local s_Preset = p_Args[1]

	if s_Preset == "normal" then
		m_GeneralSettings:PresetNormal()
	elseif s_Preset == "hardcore" then
		m_GeneralSettings:PresetHardcore()
	elseif s_Preset == "infantry" then
		m_GeneralSettings:PresetInfantry()
	elseif s_Preset == "hardcoreNoMap" then
		m_GeneralSettings:PresetHardcoreNoMap()
	elseif s_Preset == "custom" then
		m_GeneralSettings:PresetCustom(p_Args)
	else
		return
	end

	Log(p_Player.name, p_Player.name .. " changed the preset to " .. string.upper(tostring(s_Preset)))
	NetEvents:Broadcast('ServerInfo', m_GeneralSettings:GetServerConfig())
	Popup(p_Player, "Changed server settings.", "You successfully changed the server settings.")
end

-- Endregion

-- Region Manage ModSettings

function Admin:OnResetModSettings(p_Player)
	if not self:Allowed(p_Player, 'CanAlterServerSettings', 'MODSETTINGS RESET', true) then
		return
	end

	m_ModSettings:ResetModSettings()
	Log(p_Player.name, p_Player.name .. " reset the mod settings")
	Popup(p_Player, "Mod Settings reset.", "The mod settings have been reset.")
end

function Admin:OnResetAndSaveModSettings(p_Player)
	if not self:Allowed(p_Player, 'CanAlterServerSettings', 'MODSETTINGS RESET+SAVE', true) then
		return
	end

	m_ModSettings:ResetModSettings()
	m_ModSettings:SQLSaveModSettings()
	Log(p_Player.name, p_Player.name .. " reset and saved the mod settings")
	Popup(p_Player, "Mod Settings reset & saved.", "The mod settings have been reset and saved.")
end

function Admin:OnApplyModSettings(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanAlterServerSettings', 'MODSETTINGS APPLY', true) then
		return
	end

	m_ModSettings:SetModSettings(p_Args)
	Log(p_Player.name, p_Player.name .. " applied mod settings")
	Popup(p_Player, "Mod Settings applied.", "The mod settings have been applied.")
end

function Admin:OnSaveModSettings(p_Player, p_Args)
	if not self:Allowed(p_Player, 'CanAlterServerSettings', 'MODSETTINGS SAVE', true) then
		return
	end

	m_ModSettings:SetModSettings(p_Args)
	m_ModSettings:SQLSaveModSettings()
	Log(p_Player.name, p_Player.name .. " applied and saved mod settings")
	Popup(p_Player, "Mod Settings applied & saved.", "The mod settings have been applied and saved.")
end

-- Endregion

return Admin()

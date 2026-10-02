---@class BiaManager
-- Client bridge for BetterIngameAdmin:
--   WebUI -> NetEvents, NetEvents -> WebUI, F8/F9 for map votes,
--   keyboard ownership for text fields, UI prefs saved on this PC.
BiaManager = class 'BiaManager'

-- Read by Scoreboard.lua so Tab doesn't close the menu while typing.
BIA_TYPING = false

local PREFS_KEY = 'bia_ui_prefs'
local TYPING_TIMEOUT = 300 -- seconds; safety net if the WebUI never says "done"

-- WebUI event -> server NetEvent (payload passed through untouched)
local FORWARD = {
	['WebUI:SaveMapQueue'] = 'SaveMapQueue',
	['WebUI:GetMapQueue'] = 'GetMapQueue',
	['WebUI:GetBanList'] = 'GetBanList',
	['WebUI:UnbanPlayer'] = 'UnbanPlayer',
	['WebUI:GetAdminList'] = 'GetAdminList',
	['WebUI:AddAdmin'] = 'AddAdmin',
	['WebUI:RemoveAdmin'] = 'RemoveAdmin',
	['WebUI:ForceNextFromQueue'] = 'ForceNextFromQueue',
	['WebUI:AnnounceQueue'] = 'AnnounceQueue',
	['WebUI:StartMapVote'] = 'StartMapVote',
	['WebUI:MapVoteYes'] = 'MapVoteYes',
	['WebUI:MapVoteNo'] = 'MapVoteNo',
	['WebUI:BiaGetMapRotation'] = 'BiaGetMapRotation',
	['WebUI:BiaReloadMapList'] = 'BiaReloadMapList',
	['WebUI:BiaInstaMap'] = 'BiaInstaMap',
	['WebUI:BiaSay'] = 'BiaSay',
	['WebUI:BiaCancelMapVote'] = 'BiaCancelMapVote',
	['WebUI:BiaGetAdminLog'] = 'BiaGetAdminLog',
	['WebUI:BiaGetFavs'] = 'BiaGetFavs',
	['WebUI:BiaSaveFav'] = 'BiaSaveFav',
	['WebUI:BiaDeleteFav'] = 'BiaDeleteFav',
	['WebUI:BiaApplyFav'] = 'BiaApplyFav',
	['WebUI:BiaGetRoundEnd'] = 'BiaGetRoundEnd',
	['WebUI:BiaSetRoundEnd'] = 'BiaSetRoundEnd'
}

-- server NetEvent -> JS function called with the JSON-encoded payload
local TO_JS = {
	['MapQueue'] = 'restoreMapQueue',
	['BanList'] = 'getBanList',
	['AdminList'] = 'getAdminList',
	['MapVoteUpdate'] = 'updateMapVote',
	['BiaMapRotation'] = 'getCurrentMapRotation',
	['BiaAdminLog'] = 'getAdminLog',
	['BiaFavs'] = 'biaSetFavs',
	['BiaBigYell'] = 'biaBigYell',
	['BiaChatOverlay'] = 'biaChatOverlay',
	['BiaRoundEnd'] = 'biaSetRoundEnd'
}

local function CallJS(p_Function, p_Payload)
	local s_Json = json.encode(p_Payload)

	if s_Json == nil then
		return
	end

	WebUI:ExecuteJS(p_Function .. '(' .. s_Json .. ')')
end

function BiaManager:__init()
	self.m_MapVoteActive = false
	self.m_F8Down = false
	self.m_F9Down = false
	self.m_TypingSince = 0
	self.m_PrefsSetting = nil
	self:DeclarePrefsSetting()

	for l_WebEvent, l_NetEvent in pairs(FORWARD) do
		Events:Subscribe(l_WebEvent, function(p_Payload)
			if p_Payload ~= nil then
				NetEvents:Send(l_NetEvent, p_Payload)
			else
				NetEvents:Send(l_NetEvent)
			end
		end)
	end

	for l_NetEvent, l_JsFunction in pairs(TO_JS) do
		NetEvents:Subscribe(l_NetEvent, function(p_Payload)
			CallJS(l_JsFunction, p_Payload)
		end)
	end

	NetEvents:Subscribe('MapVoteStart', self, self.OnMapVoteStart)
	NetEvents:Subscribe('MapVoteEnd', self, self.OnMapVoteEnd)

	Events:Subscribe('WebUI:BiaKeyboard', self, self.OnWebKeyboard)
	Events:Subscribe('WebUI:BiaGetUiPrefs', self, self.OnWebGetUiPrefs)
	Events:Subscribe('WebUI:BiaSaveUiPrefs', self, self.OnWebSaveUiPrefs)

	Events:Subscribe('Engine:Update', self, self.OnEngineUpdate)
	Events:Subscribe('Level:Destroy', self, self.OnLevelDestroy)

	-- While a text field owns the keyboard, swallow game UI actions (chat, menu,
	-- squad screen...) so typing "j" or "t" doesn't open chat underneath.
	Hooks:Install('UI:InputConceptEvent', 999, self, self.OnUIInputConceptEvent)
end

-- Region keyboard

function BiaManager:SetTyping(p_On)
	if p_On == BIA_TYPING then
		return
	end

	BIA_TYPING = p_On

	if p_On then
		self.m_TypingSince = SharedUtils:GetTime()
		WebUI:EnableKeyboard()
		WebUI:EnableMouse()
	else
		WebUI:ResetKeyboard()
	end
end

function BiaManager:OnWebKeyboard(p_On)
	self:SetTyping(p_On == '1' or p_On == 1 or p_On == true)
end

function BiaManager:OnUIInputConceptEvent(p_HookCtx, p_EventType, p_Action)
	if not BIA_TYPING then
		return
	end

	p_HookCtx:Pass(UIInputAction.UIInputAction_None, p_EventType)
end

function BiaManager:OnLevelDestroy()
	-- WebUI reloads with the level; never leave the game's UI input blocked
	self:SetTyping(false)
	self.m_MapVoteActive = false
end

-- Endregion

-- Region UI prefs (zoom, vote popup position) - stored on THIS PC

-- Same pattern as ZoomLevel.lua: DeclareString(name, default, minLen, maxLen, SettingOptions)
function BiaManager:DeclarePrefsSetting()
	local s_Ok, s_Result = pcall(function()
		local s_Opts = SettingOptions()
		s_Opts.showInUi = false
		s_Opts.displayName = 'BIA UI'
		return SettingsManager:DeclareString(PREFS_KEY, '', 0, 2048, s_Opts)
	end)

	if s_Ok and s_Result ~= nil then
		self.m_PrefsSetting = s_Result
	else
		print('BIA - UI prefs setting unavailable: ' .. tostring(s_Result))
	end
end

function BiaManager:GetPrefsSetting()
	return self.m_PrefsSetting
end

function BiaManager:OnWebGetUiPrefs()
	local s_Setting = self:GetPrefsSetting()

	if s_Setting == nil then
		return
	end

	local s_Ok, s_Value = pcall(function()
		return s_Setting.value
	end)

	if s_Ok and type(s_Value) == 'string' and s_Value ~= '' then
		-- json.encode turns the stored string into a JS string literal
		WebUI:ExecuteJS('biaRestoreUiPrefs(' .. json.encode(s_Value) .. ')')
	end
end

function BiaManager:OnWebSaveUiPrefs(p_Json)
	if type(p_Json) ~= 'string' or #p_Json > 2048 then
		return
	end

	local s_Setting = self:GetPrefsSetting()

	if s_Setting == nil then
		return
	end

	local s_Ok, s_Err = pcall(function()
		s_Setting.value = p_Json
	end)

	if not s_Ok then
		print('BIA - UI prefs save failed: ' .. tostring(s_Err))
	end
end

-- Endregion

-- Region map vote

function BiaManager:OnMapVoteStart(p_Payload)
	self.m_MapVoteActive = true
	self.m_F8Down = true -- ignore a key that is already held when the vote opens
	self.m_F9Down = true
	CallJS('startMapVote', p_Payload)
end

function BiaManager:OnMapVoteEnd(p_Payload)
	self.m_MapVoteActive = false
	CallJS('endMapVote', p_Payload)
end

-- Edge-detect F8/F9 while a map vote is active (kick/ban votes use their own
-- handlers; we only take the keys during map votes, and never while typing).
function BiaManager:OnEngineUpdate(p_Delta)
	if BIA_TYPING and SharedUtils:GetTime() - self.m_TypingSince > TYPING_TIMEOUT then
		print('BIA - keyboard auto-released after ' .. TYPING_TIMEOUT .. 's')
		self:SetTyping(false)
		WebUI:ExecuteJS('biaKbRelease()')
	end

	if not self.m_MapVoteActive then
		return
	end

	local s_F8 = InputManager:IsKeyDown(InputDeviceKeys.IDK_F8)
	local s_F9 = InputManager:IsKeyDown(InputDeviceKeys.IDK_F9)

	if not BIA_TYPING then
		if s_F8 and not self.m_F8Down then
			NetEvents:Send('MapVoteYes')
			WebUI:ExecuteJS('biaMapVoteYes()')
		end

		if s_F9 and not self.m_F9Down then
			NetEvents:Send('MapVoteNo')
			WebUI:ExecuteJS('biaMapVoteNo()')
		end
	end

	self.m_F8Down = s_F8
	self.m_F9Down = s_F9
end

-- Endregion

return BiaManager()

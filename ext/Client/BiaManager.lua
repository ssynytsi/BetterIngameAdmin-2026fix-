---@class BiaManager
-- Client bridge: WebUI -> NetEvents, NetEvents -> WebUI, F8/F9 for map votes.
BiaManager = class 'BiaManager'

function BiaManager:__init()
	self.m_MapVoteActive = false
	self.m_F8Down = false
	self.m_F9Down = false

	Events:Subscribe('WebUI:SaveMapQueue', self, self.OnWebSaveMapQueue)
	Events:Subscribe('WebUI:GetMapQueue', self, self.OnWebGetMapQueue)
	Events:Subscribe('WebUI:GetBanList', self, self.OnWebGetBanList)
	Events:Subscribe('WebUI:UnbanPlayer', self, self.OnWebUnbanPlayer)
	Events:Subscribe('WebUI:GetAdminList', self, self.OnWebGetAdminList)
	Events:Subscribe('WebUI:AddAdmin', self, self.OnWebAddAdmin)
	Events:Subscribe('WebUI:RemoveAdmin', self, self.OnWebRemoveAdmin)
	Events:Subscribe('WebUI:ForceNextFromQueue', self, self.OnWebForceNextFromQueue)
	Events:Subscribe('WebUI:AnnounceQueue', self, self.OnWebAnnounceQueue)
	Events:Subscribe('WebUI:StartMapVote', self, self.OnWebStartMapVote)
	Events:Subscribe('WebUI:MapVoteYes', self, self.OnWebMapVoteYes)
	Events:Subscribe('WebUI:MapVoteNo', self, self.OnWebMapVoteNo)

	NetEvents:Subscribe('MapQueue', self, self.OnMapQueue)
	NetEvents:Subscribe('BanList', self, self.OnBanList)
	NetEvents:Subscribe('AdminList', self, self.OnAdminList)
	NetEvents:Subscribe('MapVoteStart', self, self.OnMapVoteStart)
	NetEvents:Subscribe('MapVoteUpdate', self, self.OnMapVoteUpdate)
	NetEvents:Subscribe('MapVoteEnd', self, self.OnMapVoteEnd)

	Events:Subscribe('Engine:Update', self, self.OnEngineUpdate)
end

function BiaManager:OnWebSaveMapQueue(p_Payload)
	NetEvents:Send('SaveMapQueue', p_Payload)
end

function BiaManager:OnWebGetMapQueue()
	NetEvents:Send('GetMapQueue')
end

function BiaManager:OnWebGetBanList()
	NetEvents:Send('GetBanList')
end

function BiaManager:OnWebUnbanPlayer(p_Name)
	NetEvents:Send('UnbanPlayer', p_Name)
end

function BiaManager:OnWebGetAdminList()
	NetEvents:Send('GetAdminList')
end

function BiaManager:OnWebAddAdmin(p_Name)
	NetEvents:Send('AddAdmin', p_Name)
end

function BiaManager:OnWebRemoveAdmin(p_Name)
	NetEvents:Send('RemoveAdmin', p_Name)
end

function BiaManager:OnWebForceNextFromQueue()
	NetEvents:Send('ForceNextFromQueue')
end

function BiaManager:OnWebAnnounceQueue()
	NetEvents:Send('AnnounceQueue')
end

function BiaManager:OnWebStartMapVote(p_Payload)
	NetEvents:Send('StartMapVote', p_Payload)
end

function BiaManager:OnWebMapVoteYes()
	NetEvents:Send('MapVoteYes')
end

function BiaManager:OnWebMapVoteNo()
	NetEvents:Send('MapVoteNo')
end

function BiaManager:OnMapQueue(p_Payload)
	local s_Json = json.encode(p_Payload)
	if s_Json == nil then return end
	WebUI:ExecuteJS('restoreMapQueue(' .. s_Json .. ')')
end

function BiaManager:OnBanList(p_Payload)
	local s_Json = json.encode(p_Payload)
	if s_Json == nil then return end
	WebUI:ExecuteJS('getBanList(' .. s_Json .. ')')
end

function BiaManager:OnAdminList(p_Payload)
	local s_Json = json.encode(p_Payload)
	if s_Json == nil then return end
	WebUI:ExecuteJS('getAdminList(' .. s_Json .. ')')
end

function BiaManager:OnMapVoteStart(p_Payload)
	self.m_MapVoteActive = true
	self.m_F8Down = false
	self.m_F9Down = false
	local s_Json = json.encode(p_Payload)
	if s_Json == nil then return end
	WebUI:ExecuteJS('startMapVote(' .. s_Json .. ')')
end

function BiaManager:OnMapVoteUpdate(p_Payload)
	local s_Json = json.encode(p_Payload)
	if s_Json == nil then return end
	WebUI:ExecuteJS('updateMapVote(' .. s_Json .. ')')
end

function BiaManager:OnMapVoteEnd(p_Payload)
	self.m_MapVoteActive = false
	local s_Json = json.encode(p_Payload)
	if s_Json == nil then return end
	WebUI:ExecuteJS('endMapVote(' .. s_Json .. ')')
end

-- Edge-detect F8/F9 while a map vote is active (existing kick/ban votes use
-- their own client handlers; we only steal the keys during map votes).
function BiaManager:OnEngineUpdate(p_Delta)
	if not self.m_MapVoteActive then
		return
	end

	local s_F8 = InputManager:IsKeyDown(InputDeviceKeys.IDK_F8)
	local s_F9 = InputManager:IsKeyDown(InputDeviceKeys.IDK_F9)

	if s_F8 and not self.m_F8Down then
		NetEvents:Send('MapVoteYes')
		WebUI:ExecuteJS('biaMapVoteYes()')
	end
	if s_F9 and not self.m_F9Down then
		NetEvents:Send('MapVoteNo')
		WebUI:ExecuteJS('biaMapVoteNo()')
	end

	self.m_F8Down = s_F8
	self.m_F9Down = s_F9
end

return BiaManager()

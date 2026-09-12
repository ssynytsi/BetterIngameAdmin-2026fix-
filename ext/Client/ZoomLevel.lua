---@class ZoomLevel
ZoomLevel = class 'ZoomLevel'

---@type Scoreboard
local m_Scoreboard = require('Scoreboard')

function ZoomLevel:__init()
	-- Client Settings
	self.m_DefaultBase = nil
	self.m_10_0xZoom = nil
	self.m_10xENVG = nil
	self.m_12_0xZoom = nil
	self.m_1xENVG = nil
	self.m_20xENVG_COOP = nil
	self.m_20xZoom = nil
	self.m_2_0xZoom = nil
	self.m_3_4xZoom = nil
	self.m_4_0xZoom = nil
	self.m_6_0xZoom = nil
	self.m_6xENVG = nil
	self.m_7_0xZoom = nil
	self.m_8_0xZoom = nil
	self.m_DefaultATSights = nil
	self.m_Fast_2_0xZoom = nil
	self.m_FastIronSights = nil
	self.m_DefaultIronSights = nil

	self.m_10_0xZoomFieldOfView = nil
	self.m_10_0xZoomLookSpeedMultiplier = nil
	self.m_10xENVGFieldOfView = nil
	self.m_10xENVGLookSpeedMultiplier = nil
	self.m_12_0xZoomFieldOfView = nil
	self.m_12_0xZoomLookSpeedMultiplier = nil
	self.m_1xENVGFieldOfView = nil
	self.m_1xENVGLookSpeedMultiplier = nil
	self.m_20xENVG_COOPFieldOfView = nil
	self.m_20xENVG_COOPLookSpeedMultiplier = nil
	self.m_20xZoomFieldOfView = nil
	self.m_20xZoomLookSpeedMultiplier = nil
	self.m_2_0xZoomFieldOfView = nil
	self.m_2_0xZoomLookSpeedMultiplier = nil
	self.m_3_4xZoomFieldOfView = nil
	self.m_3_4xZoomLookSpeedMultiplier = nil
	self.m_4_0xZoomFieldOfView = nil
	self.m_4_0xZoomLookSpeedMultiplier = nil
	self.m_6_0xZoomFieldOfView = nil
	self.m_6_0xZoomLookSpeedMultiplier = nil
	self.m_6xENVGFieldOfView = nil
	self.m_6xENVGLookSpeedMultiplier = nil
	self.m_7_0xZoomFieldOfView = nil
	self.m_7_0xZoomLookSpeedMultiplier = nil
	self.m_8_0xZoomFieldOfView = nil
	self.m_8_0xZoomLookSpeedMultiplier = nil
	self.m_DefaultATSightsFieldOfView = nil
	self.m_DefaultATSightsLookSpeedMultiplier = nil
	self.m_Fast_2_0xZoomFieldOfView = nil
	self.m_Fast_2_0xZoomLookSpeedMultiplier = nil
	self.m_FastIronSightsFieldOfView = nil
	self.m_FastIronSightsLookSpeedMultiplier = nil
	self.m_DefaultIronSightsFieldOfView = nil
	self.m_DefaultIronSightsLookSpeedMultiplier = nil
	self.m_DefaultBaseFieldOfView = nil

	Events:Subscribe('WebUI:GetMouseSensitivity', self, self.OnWebUIGetMouseSensitivity)
	Events:Subscribe('WebUI:SetMouseSensitivity', self, self.OnWebUISetMouseSensitivity)
	Events:Subscribe('WebUI:GetMouseSensitivityMultipliers', self, self.OnWebUIGetMouseSensitivityMultipliers)
	Events:Subscribe('WebUI:SetMouseSensitivityMultipliers', self, self.OnWebUISetMouseSensitivityMultipliers)
	Events:Subscribe('WebUI:ResetMouseSensitivityMultipliers', self, self.OnWebUIResetMouseSensitivityMultipliers)
	Events:Subscribe('WebUI:GetFieldOfView', self, self.OnWebUIGetFieldOfView)
	Events:Subscribe('WebUI:SetFieldOfView', self, self.OnWebUISetFieldOfView)
	Events:Subscribe('WebUI:ResetFieldOfView', self, self.OnWebUIResetFieldOfView)

	Events:Subscribe('Level:Destroy', self, self.OnLevelDestroy)
	Events:Subscribe('Level:Loaded', self, self.OnLevelLoadedSettings)
	Events:Subscribe('Extension:Loaded', self, self.OnExtensionLoadedSettings)

	self:DeclarePersistentSettings()
	self:RegisterResourceManagerCallbacks()
end

-- Region MouseSensitivity and Field Of View
function ZoomLevel:OnWebUIGetMouseSensitivity()
	if not m_Scoreboard:GetToggleScoreboard() then
		m_Scoreboard:SetIgnoreReleaseTab(true)
	end

	local s_MouseSensitivity = InputManager:GetMouseSensitivity()
	WebUI:ExecuteJS(string.format("getMouseSensitivity(%s)", json.encode(s_MouseSensitivity)))
end

function ZoomLevel:OnWebUISetMouseSensitivity(mouseSensitivity)
	InputManager:SetMouseSensitivity(tonumber(mouseSensitivity))
	self:PersistSensBase(tonumber(mouseSensitivity))
end

function ZoomLevel:OnWebUIGetMouseSensitivityMultipliers()
	if not m_Scoreboard:GetToggleScoreboard() then
		m_Scoreboard:SetIgnoreReleaseTab(true)
	end

	local s_Args = {
		self:GetLookSpeed('m_DefaultIronSights', 0.5),
		self:GetLookSpeed('m_2_0xZoom', 0.4),
		self:GetLookSpeed('m_3_4xZoom', 0.3),
		self:GetLookSpeed('m_4_0xZoom', 0.25),
		self:GetLookSpeed('m_6_0xZoom', 0.2),
		self:GetLookSpeed('m_7_0xZoom', 0.18),
		self:GetLookSpeed('m_8_0xZoom', 0.15),
		self:GetLookSpeed('m_10_0xZoom', 0.13),
		self:GetLookSpeed('m_12_0xZoom', 0.11),
		self:GetLookSpeed('m_20xZoom', 0.08)
	}
	WebUI:ExecuteJS(string.format("getMouseSensitivityMultipliers(%s)", json.encode(s_Args)))
end

function ZoomLevel:OnWebUISetMouseSensitivityMultipliers(p_Args)
	p_Args = json.decode(p_Args)
	self:PersistSens(p_Args)
	self:ApplyLookSpeed('m_DefaultIronSights', tonumber(p_Args[1])) -- kobra rds and none and igla
	self:ApplyLookSpeed('m_FastIronSights', tonumber(p_Args[1])) -- pistols and small weapons like F2000, pdws and shotguns
	self:ApplyLookSpeed('m_Fast_2_0xZoom', tonumber(p_Args[2])) -- holo of smaller weapons like F2000, pdws and shotguns
	self:ApplyLookSpeed('m_DefaultATSights', tonumber(p_Args[1])) -- stinger and javelin only
	self:ApplyLookSpeed('m_1xENVG', tonumber(p_Args[1])) -- IRNV scope
	self:ApplyLookSpeed('m_2_0xZoom', tonumber(p_Args[2])) -- holo, pkas
	self:ApplyLookSpeed('m_3_4xZoom', tonumber(p_Args[3])) -- pka, m145 3.4
	self:ApplyLookSpeed('m_4_0xZoom', tonumber(p_Args[4])) -- acog, pso 4.0
	self:ApplyLookSpeed('m_6_0xZoom', tonumber(p_Args[5])) -- Rifle Scope 6.0
	self:ApplyLookSpeed('m_6xENVG', tonumber(p_Args[5])) -- SVD SinglePlayer -- better just remove
	self:ApplyLookSpeed('m_7_0xZoom', tonumber(p_Args[6])) -- PKS-07
	self:ApplyLookSpeed('m_8_0xZoom', tonumber(p_Args[7])) -- Rifle Scope 8.0
	self:ApplyLookSpeed('m_10_0xZoom', tonumber(p_Args[8])) -- Ballistic Scope 12.0 -- small weapons like F2000 --wtf its actually 10x haha
	self:ApplyLookSpeed('m_10xENVG', tonumber(p_Args[8])) -- SP M40 and M82
	self:ApplyLookSpeed('m_12_0xZoom', tonumber(p_Args[9])) -- Ballistic Scope 12.0
	self:ApplyLookSpeed('m_20xZoom', tonumber(p_Args[10])) -- Ballistic Scope 20.0 only L96
	self:ApplyLookSpeed('m_20xENVG_COOP', tonumber(p_Args[10])) -- mk11 coop
end

function ZoomLevel:OnWebUIResetMouseSensitivityMultipliers()
	self:ApplyLookSpeed('m_DefaultIronSights', 0.5) -- 1
	self:ApplyLookSpeed('m_FastIronSights', 0.5) -- 1
	self:ApplyLookSpeed('m_Fast_2_0xZoom', 0.3199999) -- 3
	self:ApplyLookSpeed('m_DefaultATSights', 0.5) -- 1
	self:ApplyLookSpeed('m_1xENVG', 0.5) -- 1
	self:ApplyLookSpeed('m_2_0xZoom', 0.3199999) -- 3
	self:ApplyLookSpeed('m_3_4xZoom', 0.36) -- 2
	self:ApplyLookSpeed('m_4_0xZoom', 0.31) -- 4
	self:ApplyLookSpeed('m_6_0xZoom', 0.2099999) -- 5
	self:ApplyLookSpeed('m_6xENVG', 0.2099999) -- 5
	self:ApplyLookSpeed('m_7_0xZoom', 0.2099999) -- 5
	self:ApplyLookSpeed('m_8_0xZoom', 0.1599999) -- 6
	self:ApplyLookSpeed('m_10_0xZoom', 0.1299999) -- 7
	self:ApplyLookSpeed('m_10xENVG', 0.1299999) -- 7
	self:ApplyLookSpeed('m_12_0xZoom', 0.1099999) -- 8
	self:ApplyLookSpeed('m_20xZoom', 0.0799999) -- 9
	self:ApplyLookSpeed('m_20xENVG_COOP', 0.0799999) -- 9

	self:OnWebUIGetMouseSensitivityMultipliers()
end

function ZoomLevel:OnWebUIGetFieldOfView()
	if not m_Scoreboard:GetToggleScoreboard() then
		m_Scoreboard:SetIgnoreReleaseTab(true)
	end

	local s_Args = {
		VDEGtoHDEG(self:GetFov('m_DefaultBase', 55)),
		VDEGtoHDEG(self:GetFov('m_DefaultIronSights', 40)),
		VDEGtoHDEG(self:GetFov('m_2_0xZoom', 32)),
		VDEGtoHDEG(self:GetFov('m_3_4xZoom', 20)),
		VDEGtoHDEG(self:GetFov('m_4_0xZoom', 17.2)),
		VDEGtoHDEG(self:GetFov('m_6_0xZoom', 11.6)),
		VDEGtoHDEG(self:GetFov('m_7_0xZoom', 9.899999)),
		VDEGtoHDEG(self:GetFov('m_8_0xZoom', 8.699999)),
		VDEGtoHDEG(self:GetFov('m_10_0xZoom', 7)),
		VDEGtoHDEG(self:GetFov('m_12_0xZoom', 5.8)),
		VDEGtoHDEG(self:GetFov('m_20xZoom', 3.5))
	}
	WebUI:ExecuteJS(string.format("getFieldOfView(%s)", json.encode(s_Args)))
end

function ZoomLevel:OnWebUISetFieldOfView(p_Args)
	p_Args = json.decode(p_Args)
	self:PersistFov(p_Args)
	self:ApplyFov('m_DefaultBase', HDEGtoVDEG(tonumber(p_Args[1])))
	self:ApplyFov('m_DefaultIronSights', HDEGtoVDEG(tonumber(p_Args[2]))) -- kobra rds and none and igla
	self:ApplyFov('m_FastIronSights', HDEGtoVDEG(tonumber(p_Args[2]))) -- pistols and small weapons like F2000, pdws and shotguns
	self:ApplyFov('m_Fast_2_0xZoom', HDEGtoVDEG(tonumber(p_Args[3]))) -- holo of smaller weapons like F2000, pdws and shotguns
	self:ApplyFov('m_DefaultATSights', HDEGtoVDEG(tonumber(p_Args[2]))) -- stinger and javelin only
	self:ApplyFov('m_1xENVG', HDEGtoVDEG(tonumber(p_Args[2]))) -- IRNV scope
	self:ApplyFov('m_2_0xZoom', HDEGtoVDEG(tonumber(p_Args[3]))) -- holo, pkas
	self:ApplyFov('m_3_4xZoom', HDEGtoVDEG(tonumber(p_Args[4]))) -- pka, m145 3.4
	self:ApplyFov('m_4_0xZoom', HDEGtoVDEG(tonumber(p_Args[5]))) -- acog, pso 4.0
	self:ApplyFov('m_6_0xZoom', HDEGtoVDEG(tonumber(p_Args[6]))) -- Rifle Scope 6.0
	self:ApplyFov('m_6xENVG', HDEGtoVDEG(tonumber(p_Args[6]))) -- SVD SinglePlayer -- better just remove
	self:ApplyFov('m_7_0xZoom', HDEGtoVDEG(tonumber(p_Args[7]))) -- PKS-07
	self:ApplyFov('m_8_0xZoom', HDEGtoVDEG(tonumber(p_Args[8]))) -- Rifle Scope 8.0
	self:ApplyFov('m_10_0xZoom', HDEGtoVDEG(tonumber(p_Args[9]))) -- Ballistic Scope 12.0 -- small weapons like F2000 --wtf its actually 10x haha
	self:ApplyFov('m_10xENVG', HDEGtoVDEG(tonumber(p_Args[9]))) -- SP M40 and M82
	self:ApplyFov('m_12_0xZoom', HDEGtoVDEG(tonumber(p_Args[10]))) -- Ballistic Scope 12.0
	self:ApplyFov('m_20xZoom', HDEGtoVDEG(tonumber(p_Args[11]))) -- Ballistic Scope 20.0 only L96
	self:ApplyFov('m_20xENVG_COOP', HDEGtoVDEG(tonumber(p_Args[11]))) -- mk11 coop
end

function ZoomLevel:OnWebUIResetFieldOfView()
	self:ApplyFov('m_DefaultBase', 55) -- 1
	self:ApplyFov('m_DefaultIronSights', 40) -- 1
	self:ApplyFov('m_FastIronSights', 40) -- 1
	self:ApplyFov('m_Fast_2_0xZoom', 32) -- 3
	self:ApplyFov('m_DefaultATSights', 40) -- 1
	self:ApplyFov('m_1xENVG', 40) -- 1
	self:ApplyFov('m_2_0xZoom', 32) -- 3
	self:ApplyFov('m_3_4xZoom', 20) -- 2
	self:ApplyFov('m_4_0xZoom', 17.2) -- 4
	self:ApplyFov('m_6_0xZoom', 11.6) -- 5
	self:ApplyFov('m_6xENVG', 11.6) -- 5
	self:ApplyFov('m_7_0xZoom', 9.899999) -- 5
	self:ApplyFov('m_8_0xZoom', 8.699999) -- 6
	self:ApplyFov('m_10_0xZoom', 7) -- 7
	self:ApplyFov('m_10xENVG', 7) -- 7
	self:ApplyFov('m_12_0xZoom', 5.8) -- 8
	self:ApplyFov('m_20xZoom', 3.5) -- 9
	self:ApplyFov('m_20xENVG_COOP', 3.5) -- 9

	self:OnWebUIGetFieldOfView()
end

function VDEGtoHDEG(p_Arg)
	local fourthree = 4 / 3
	local vfovRad = tonumber(p_Arg) *math.pi /180
	local hfovRad = math.atan(math.tan(vfovRad/2)*fourthree)*2
	local endFov = hfovRad / math.pi *180

	return endFov
end

function HDEGtoVDEG(p_Arg)
	local fourthree = 4 / 3
	local vfovRad = tonumber(p_Arg) *math.pi /180
	local hfovRad = math.atan(math.tan(vfovRad/2)/fourthree)*2
	local endFov = hfovRad / math.pi *180

	return endFov
end

-- Region Nil-safe zoom level access
-- The m_* instances only exist while a level's ZoomLevelData is loaded. The WebUI
-- can ask for these values at any time (loading screen, menu, after Level:Destroy),
-- so every read/write goes through these helpers instead of indexing directly.
function ZoomLevel:GetFov(p_Name, p_Default)
	local s_Instance = self[p_Name]

	if s_Instance ~= nil then
		return s_Instance.fieldOfView
	end

	local s_Cached = self[p_Name .. 'FieldOfView']

	if s_Cached ~= nil then
		return s_Cached
	end

	return p_Default
end

function ZoomLevel:GetLookSpeed(p_Name, p_Default)
	local s_Instance = self[p_Name]

	if s_Instance ~= nil then
		return s_Instance.lookSpeedMultiplier
	end

	local s_Cached = self[p_Name .. 'LookSpeedMultiplier']

	if s_Cached ~= nil then
		return s_Cached
	end

	return p_Default
end

-- Always cache the value so it survives a level change and gets re-applied by the
-- instance load handler, then write it through only if the instance is loaded.
function ZoomLevel:ApplyFov(p_Name, p_Value)
	self[p_Name .. 'FieldOfView'] = p_Value

	if self[p_Name] ~= nil then
		self[p_Name].fieldOfView = p_Value
	end
end

function ZoomLevel:ApplyLookSpeed(p_Name, p_Value)
	self[p_Name .. 'LookSpeedMultiplier'] = p_Value

	if self[p_Name] ~= nil then
		self[p_Name].lookSpeedMultiplier = p_Value
	end
end
-- Endregion

function ZoomLevel:RegisterResourceManagerCallbacks()
	ResourceManager:RegisterInstanceLoadHandler(Guid("895050F3-B0D1-4F83-A57B-CCFA3EB0B31D", "D"), Guid("5C006FDF-FA1D-4E29-8E21-2ECAB83AC01C", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_DefaultIronSights = p_Instance

		if self.m_DefaultIronSightsFieldOfView ~= nil then
			self.m_DefaultIronSights.fieldOfView = self.m_DefaultIronSightsFieldOfView
		end

		if self.m_DefaultIronSightsLookSpeedMultiplier ~= nil then
			self.m_DefaultIronSights.lookSpeedMultiplier = self.m_DefaultIronSightsLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("FFEAFC24-9812-44BF-AD98-EBC06193739C", "D"), Guid("50887762-21DF-42F5-9740-ECDBCEECC3B4", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_FastIronSights = p_Instance

		if self.m_FastIronSightsFieldOfView ~= nil then
			self.m_FastIronSights.fieldOfView = self.m_FastIronSightsFieldOfView
		end

		if self.m_FastIronSightsLookSpeedMultiplier ~= nil then
			self.m_FastIronSights.lookSpeedMultiplier = self.m_FastIronSightsLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("DF98AF9C-A315-4B68-BD63-31DFAA5FABCF", "D"), Guid("83D88E7E-D266-430A-8664-CA15AFFA0D66", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_Fast_2_0xZoom = p_Instance

		if self.m_Fast_2_0xZoomFieldOfView ~= nil then
			self.m_Fast_2_0xZoom.fieldOfView = self.m_Fast_2_0xZoomFieldOfView
		end

		if self.m_Fast_2_0xZoomLookSpeedMultiplier ~= nil then
			self.m_Fast_2_0xZoom.lookSpeedMultiplier = self.m_Fast_2_0xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("A211D3C5-2DA2-4A60-8A49-5F4D90D32CCB", "D"), Guid("A83312DC-829D-4B36-9A9B-F0140876E14A", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_DefaultATSights = p_Instance

		if self.m_DefaultATSightsFieldOfView ~= nil then
			self.m_DefaultATSights.fieldOfView = self.m_DefaultATSightsFieldOfView
		end

		if self.m_DefaultATSightsLookSpeedMultiplier ~= nil then
			self.m_DefaultATSights.lookSpeedMultiplier = self.m_DefaultATSightsLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("725A64F5-4A69-4F67-A933-89E43BB1E641", "D"), Guid("C6913617-8845-4A35-9146-38F2A988EC03", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_8_0xZoom = p_Instance

		if self.m_8_0xZoomFieldOfView ~= nil then
			self.m_8_0xZoom.fieldOfView = self.m_8_0xZoomFieldOfView
		end

		if self.m_8_0xZoomLookSpeedMultiplier ~= nil then
			self.m_8_0xZoom.lookSpeedMultiplier = self.m_8_0xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("D6C590F7-9AFE-4B45-BA23-5D187678C42C", "D"), Guid("BC4F88FE-DC56-4EDB-B2C6-9ABAFD993A88", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_7_0xZoom = p_Instance

		if self.m_7_0xZoomFieldOfView ~= nil then
			self.m_7_0xZoom.fieldOfView = self.m_7_0xZoomFieldOfView
		end

		if self.m_7_0xZoomLookSpeedMultiplier ~= nil then
			self.m_7_0xZoom.lookSpeedMultiplier = self.m_7_0xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("8815B047-AEB1-4BCB-9A25-0128D948B3EE", "D"), Guid("6A83DD0E-1CA3-47DF-A829-F0EFEFF228F1", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_6xENVG = p_Instance

		if self.m_6xENVGFieldOfView ~= nil then
			self.m_6xENVG.fieldOfView = self.m_6xENVGFieldOfView
		end

		if self.m_6xENVGLookSpeedMultiplier ~= nil then
			self.m_6xENVG.lookSpeedMultiplier = self.m_6xENVGLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("1EDCC582-8B61-44DC-876C-C2DBB03FF74B", "D"), Guid("531FFD11-A7A9-4175-9049-7ADA2333931D", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_6_0xZoom = p_Instance

		if self.m_6_0xZoomFieldOfView ~= nil then
			self.m_6_0xZoom.fieldOfView = self.m_6_0xZoomFieldOfView
		end

		if self.m_6_0xZoomLookSpeedMultiplier ~= nil then
			self.m_6_0xZoom.lookSpeedMultiplier = self.m_6_0xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("7F25A028-ED1A-4B4E-A291-8A8E8B3A9159", "D"), Guid("BF74D9F8-E11C-4075-BDDB-AAC3F27C608D", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_4_0xZoom = p_Instance

		if self.m_4_0xZoomFieldOfView ~= nil then
			self.m_4_0xZoom.fieldOfView = self.m_4_0xZoomFieldOfView
		end

		if self.m_4_0xZoomLookSpeedMultiplier ~= nil then
			self.m_4_0xZoom.lookSpeedMultiplier = self.m_4_0xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("6E7D36F2-7BAC-4E20-A8D7-8ABF9F7FC6D2", "D"), Guid("E7AA2666-EE70-4B9F-A918-7686E7932DAF", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_3_4xZoom = p_Instance

		if self.m_3_4xZoomFieldOfView ~= nil then
			self.m_3_4xZoom.fieldOfView = self.m_3_4xZoomFieldOfView
		end

		if self.m_3_4xZoomLookSpeedMultiplier ~= nil then
			self.m_3_4xZoom.lookSpeedMultiplier = self.m_3_4xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("3D6A5B06-8046-47E8-8EE6-348E878E5DF5", "D"), Guid("B06E9839-DA28-42E6-86C4-42D1F8E3AADB", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_2_0xZoom = p_Instance

		if self.m_2_0xZoomFieldOfView ~= nil then
			self.m_2_0xZoom.fieldOfView = self.m_2_0xZoomFieldOfView
		end

		if self.m_2_0xZoomLookSpeedMultiplier ~= nil then
			self.m_2_0xZoom.lookSpeedMultiplier = self.m_2_0xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("609CC1AC-4B36-4197-B1C1-2357E57CEBAF", "D"), Guid("34C9BF53-1E0C-42D3-9EC1-696421E8A420", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_20xZoom = p_Instance

		if self.m_20xZoomFieldOfView ~= nil then
			self.m_20xZoom.fieldOfView = self.m_20xZoomFieldOfView
		end

		if self.m_20xZoomLookSpeedMultiplier ~= nil then
			self.m_20xZoom.lookSpeedMultiplier = self.m_20xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("401211FA-7E01-4019-BA4A-247406AD4776", "D"), Guid("9C462DC8-87D6-41B0-A4EF-9111E8D960B0", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_20xENVG_COOP = p_Instance

		if self.m_20xENVG_COOPFieldOfView ~= nil then
			self.m_20xENVG_COOP.fieldOfView = self.m_20xENVG_COOPFieldOfView
		end

		if self.m_20xENVG_COOPLookSpeedMultiplier ~= nil then
			self.m_20xENVG_COOP.lookSpeedMultiplier = self.m_20xENVG_COOPLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("C28310FD-2731-44A3-9B56-A048B3227EA6", "D"), Guid("242DAE61-CC3D-428A-8AC5-324FA95EBE7B", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_1xENVG = p_Instance

		if self.m_1xENVGFieldOfView ~= nil then
			self.m_1xENVG.fieldOfView = self.m_1xENVGFieldOfView
		end

		if self.m_1xENVGLookSpeedMultiplier ~= nil then
			self.m_1xENVG.lookSpeedMultiplier = self.m_1xENVGLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("72AFA964-EFE0-4203-83E2-88052DD7ECBA", "D"), Guid("B6B46C0F-92B8-4F9F-9429-595261801A14", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_12_0xZoom = p_Instance

		if self.m_12_0xZoomFieldOfView ~= nil then
			self.m_12_0xZoom.fieldOfView = self.m_12_0xZoomFieldOfView
		end

		if self.m_12_0xZoomLookSpeedMultiplier ~= nil then
			self.m_12_0xZoom.lookSpeedMultiplier = self.m_12_0xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("D8CE5A90-5A74-4726-9D3C-B879996246E1", "D"), Guid("E754B4D6-BAD4-4FEE-9E00-8F9C4904975E", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_10xENVG = p_Instance

		if self.m_10xENVGFieldOfView ~= nil then
			self.m_10xENVG.fieldOfView = self.m_10xENVGFieldOfView
		end

		if self.m_10xENVGLookSpeedMultiplier ~= nil then
			self.m_10xENVG.lookSpeedMultiplier = self.m_10xENVGLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("F412EBAD-2551-4832-93A0-B9E1A412FB5D", "D"), Guid("E068484D-EE7F-4199-992A-59772D8B7D4B", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_10_0xZoom = p_Instance

		if self.m_10_0xZoomFieldOfView ~= nil then
			self.m_10_0xZoom.fieldOfView = self.m_10_0xZoomFieldOfView
		end

		if self.m_10_0xZoomLookSpeedMultiplier ~= nil then
			self.m_10_0xZoom.lookSpeedMultiplier = self.m_10_0xZoomLookSpeedMultiplier
		end
	end)

	ResourceManager:RegisterInstanceLoadHandler(Guid("FDAAAC18-0AC9-4E17-A723-4EC293FB0813", "D"), Guid("B2D0DC9F-B2A0-4B50-8BA5-A56B7AF1E44B", "D"), function(p_Instance)
		p_Instance = ZoomLevelData(p_Instance)
		p_Instance:MakeWritable()
		self.m_DefaultBase = p_Instance -- use ClientUtils:SetFieldOfView() when available

		if self.m_DefaultBaseFieldOfView ~= nil then
			self.m_DefaultBase.fieldOfView = self.m_DefaultBaseFieldOfView
		end
	end)
end

function ZoomLevel:OnLevelDestroy()
	if self.m_10_0xZoom ~= nil then
		self.m_10_0xZoomFieldOfView = self.m_10_0xZoom.fieldOfView
		self.m_10_0xZoomLookSpeedMultiplier = self.m_10_0xZoom.lookSpeedMultiplier
	end

	if self.m_10xENVG ~= nil then
		self.m_10xENVGFieldOfView = self.m_10xENVG.fieldOfView
		self.m_10xENVGLookSpeedMultiplier = self.m_10xENVG.lookSpeedMultiplier
	end

	if self.m_12_0xZoom ~= nil then
		self.m_12_0xZoomFieldOfView = self.m_12_0xZoom.fieldOfView
		self.m_12_0xZoomLookSpeedMultiplier = self.m_12_0xZoom.lookSpeedMultiplier
	end

	if self.m_1xENVG ~= nil then
		self.m_1xENVGFieldOfView = self.m_1xENVG.fieldOfView
		self.m_1xENVGLookSpeedMultiplier = self.m_1xENVG.lookSpeedMultiplier
	end

	if self.m_20xENVG_COOP ~= nil then
		self.m_20xENVG_COOPFieldOfView = self.m_20xENVG_COOP.fieldOfView
		self.m_20xENVG_COOPLookSpeedMultiplier = self.m_20xENVG_COOP.lookSpeedMultiplier
	end

	if self.m_20xZoom ~= nil then
		self.m_20xZoomFieldOfView = self.m_20xZoom.fieldOfView
		self.m_20xZoomLookSpeedMultiplier = self.m_20xZoom.lookSpeedMultiplier
	end

	if self.m_2_0xZoom ~= nil then
		self.m_2_0xZoomFieldOfView = self.m_2_0xZoom.fieldOfView
		self.m_2_0xZoomLookSpeedMultiplier = self.m_2_0xZoom.lookSpeedMultiplier
	end

	if self.m_3_4xZoom ~= nil then
		self.m_3_4xZoomFieldOfView = self.m_3_4xZoom.fieldOfView
		self.m_3_4xZoomLookSpeedMultiplier = self.m_3_4xZoom.lookSpeedMultiplier
	end

	if self.m_4_0xZoom ~= nil then
		self.m_4_0xZoomFieldOfView = self.m_4_0xZoom.fieldOfView
		self.m_4_0xZoomLookSpeedMultiplier = self.m_4_0xZoom.lookSpeedMultiplier
	end

	if self.m_6_0xZoom ~= nil then
		self.m_6_0xZoomFieldOfView = self.m_6_0xZoom.fieldOfView
		self.m_6_0xZoomLookSpeedMultiplier = self.m_6_0xZoom.lookSpeedMultiplier
	end

	if self.m_6xENVG ~= nil then
		self.m_6xENVGFieldOfView = self.m_6xENVG.fieldOfView
		self.m_6xENVGLookSpeedMultiplier = self.m_6xENVG.lookSpeedMultiplier
	end

	if self.m_7_0xZoom ~= nil then
		self.m_7_0xZoomFieldOfView = self.m_7_0xZoom.fieldOfView
		self.m_7_0xZoomLookSpeedMultiplier = self.m_7_0xZoom.lookSpeedMultiplier
	end

	if self.m_8_0xZoom ~= nil then
		self.m_8_0xZoomFieldOfView = self.m_8_0xZoom.fieldOfView
		self.m_8_0xZoomLookSpeedMultiplier = self.m_8_0xZoom.lookSpeedMultiplier
	end

	if self.m_DefaultATSights ~= nil then
		self.m_DefaultATSightsFieldOfView = self.m_DefaultATSights.fieldOfView
		self.m_DefaultATSightsLookSpeedMultiplier = self.m_DefaultATSights.lookSpeedMultiplier
	end

	if self.m_Fast_2_0xZoom ~= nil then
		self.m_Fast_2_0xZoomFieldOfView = self.m_Fast_2_0xZoom.fieldOfView
		self.m_Fast_2_0xZoomLookSpeedMultiplier = self.m_Fast_2_0xZoom.lookSpeedMultiplier
	end

	if self.m_FastIronSights ~= nil then
		self.m_FastIronSightsFieldOfView = self.m_FastIronSights.fieldOfView
		self.m_FastIronSightsLookSpeedMultiplier = self.m_FastIronSights.lookSpeedMultiplier
	end

	if self.m_DefaultIronSights ~= nil then
		self.m_DefaultIronSightsFieldOfView = self.m_DefaultIronSights.fieldOfView
		self.m_DefaultIronSightsLookSpeedMultiplier = self.m_DefaultIronSights.lookSpeedMultiplier
	end

	if self.m_DefaultBase ~= nil then
		self.m_DefaultBaseFieldOfView = self.m_DefaultBase.fieldOfView
	end

	self.m_DefaultBase = nil
	self.m_10_0xZoom = nil
	self.m_10xENVG = nil
	self.m_12_0xZoom = nil
	self.m_1xENVG = nil
	self.m_20xENVG_COOP = nil
	self.m_20xZoom = nil
	self.m_2_0xZoom = nil
	self.m_3_4xZoom = nil
	self.m_4_0xZoom = nil
	self.m_6_0xZoom = nil
	self.m_6xENVG = nil
	self.m_7_0xZoom = nil
	self.m_8_0xZoom = nil
	self.m_DefaultATSights = nil
	self.m_Fast_2_0xZoom = nil
	self.m_FastIronSights = nil
	self.m_DefaultIronSights = nil
end





-- Region Client SettingsManager persistence (this PC / VU profile — not server SQL)
-- Official API: SettingsManager:DeclareString + ModSetting.value
-- WebUI:SetLocalSetting does NOT exist in VU docs.

function ZoomLevel:DeclarePersistentSettings()
	local s_Opts = SettingOptions()
	s_Opts.showInUi = false
	s_Opts.displayName = 'BIA Look'

	-- JSON blobs; max length large enough for full FOV/sens arrays
	self.m_SettingFov = SettingsManager:DeclareString('bia_look_fov', '', 0, 8192, s_Opts)
	self.m_SettingSens = SettingsManager:DeclareString('bia_look_sens', '', 0, 4096, s_Opts)
	self.m_SettingSensBase = SettingsManager:DeclareString('bia_look_sensBase', '', 0, 64, s_Opts)
end

function ZoomLevel:PersistFov(p_Args)
	if self.m_SettingFov == nil or p_Args == nil then
		return
	end
	local s_Json = json.encode(p_Args)
	if s_Json then
		self.m_SettingFov.value = s_Json
	end
end

function ZoomLevel:PersistSens(p_Args)
	if self.m_SettingSens == nil or p_Args == nil then
		return
	end
	local s_Json = json.encode(p_Args)
	if s_Json then
		self.m_SettingSens.value = s_Json
	end
end

function ZoomLevel:PersistSensBase(p_Value)
	if self.m_SettingSensBase == nil or p_Value == nil then
		return
	end
	self.m_SettingSensBase.value = tostring(p_Value)
end

function ZoomLevel:LoadPersistentSettings()
	if self.m_SettingFov == nil then
		return
	end

	local s_Fov = self.m_SettingFov.value
	if type(s_Fov) == 'string' and s_Fov ~= '' then
		-- ApplyFov caches + writes instances if loaded
		self:OnWebUISetFieldOfView(s_Fov)
	end

	local s_Sens = self.m_SettingSens.value
	if type(s_Sens) == 'string' and s_Sens ~= '' then
		self:OnWebUISetMouseSensitivityMultipliers(s_Sens)
	end

	local s_Base = self.m_SettingSensBase.value
	if type(s_Base) == 'string' and s_Base ~= '' then
		self:OnWebUISetMouseSensitivity(s_Base)
	end
end

function ZoomLevel:OnExtensionLoadedSettings()
	self:LoadPersistentSettings()
end

function ZoomLevel:OnLevelLoadedSettings()
	-- Re-apply after ZoomLevelData instances bind
	self:LoadPersistentSettings()
end
-- Endregion


return ZoomLevel()

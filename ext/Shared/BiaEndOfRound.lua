-- End-of-round screen timing (merged from the "end of round time" mod).
-- Runs on server AND client (ext/Shared). Server BiaManager picks a profile
-- (Instavote / Regular) right before it calls mapList.endRound.
--
-- Changes vs the original mod:
--  * keeps references to the loaded instances and re-applies new values to
--    them immediately, so a profile switch mid-round can take effect without
--    waiting for the next level load (the original only applied at load).
--  * the NetEvent is only subscribed on the CLIENT. The original also
--    subscribed it on the server, so any client could change server timing.

local s_Menu, s_Msg, s_Board = 15, 4, 4
local s_Inst = nil

local function Apply()
	if s_Inst == nil then
		return
	end

	local s_Ok, s_Err = pcall(function()
		s_Inst.eor:MakeWritable()
		s_Inst.eor.preEorTime = s_Msg + s_Board -- appears unused by the game
		s_Inst.eor.eorTime = s_Menu

		-- "YOUR TEAM WINS" shown for s_Msg, then the scoreboard
		s_Inst.scoreboard:MakeWritable()
		s_Inst.scoreboard.delay = s_Msg

		-- end-of-round menu after message + scoreboard
		s_Inst.menu:MakeWritable()
		s_Inst.menu.delay = s_Msg + s_Board

		-- 'SetCompletedThenLoadLevel' -> next level
		s_Inst.total:MakeWritable()
		s_Inst.total.delay = s_Msg + s_Board + s_Menu
	end)

	if not s_Ok then
		print('BIA - EOR - could not apply timings: ' .. tostring(s_Err))
	end
end

ResourceManager:RegisterInstanceLoadHandler(Guid('16B1ED36-3913-11E0-94FF-C50C1D263AB9'), Guid('E8F2B62A-5214-4F26-98F9-C64EA35210E4'), function(p_Instance)
	local s_Eor = UIEndOfRoundEntityData(p_Instance)
	local s_Partition = s_Eor.partition

	s_Inst = {
		eor = s_Eor,
		scoreboard = DelayEntityData(s_Partition:FindInstance(Guid('D489A728-E711-4939-B871-946FD1D8B9F8'))),
		menu = DelayEntityData(s_Partition:FindInstance(Guid('D5C85606-C278-4C8E-ABFC-35EE93C5E5FE'))),
		total = DelayEntityData(s_Partition:FindInstance(Guid('524B0EC0-D986-46F8-9F7A-386DF5089F60')))
	}

	Apply()
end)

Events:Subscribe('Level:Destroy', function()
	s_Inst = nil
end)

local function SetValues(p_Menu, p_Msg, p_Board)
	s_Menu = tonumber(p_Menu) or s_Menu
	s_Msg = tonumber(p_Msg) or s_Msg
	s_Board = tonumber(p_Board) or s_Board
	Apply()
end

Events:Subscribe('BIA:EorTimes', SetValues)

if SharedUtils:IsClientModule() then
	NetEvents:Subscribe('BIA:EorTimes', SetValues)
end

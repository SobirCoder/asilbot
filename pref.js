class Pref {
	static get REG_EMPLOYEE() { return 'Register'; }
	static get REG_NOT_IN_THIS_LIST() { return `Im not in this list`; }
	
	static get CHECK_IN() { return 'In'; }
	static get CHECK_OUT() { return 'Out'; }

	static get BACK() { return 'Back'; }
	static get LATE() { return 'Late'; }

	static get IN_TIME() { return 'In time'; }
	static get WORK_OF_OFFICE() { return 'Work of office'; }
	static get MY_OWN_BUSINESS() { return 'My own business'; }
	static get APPROVED_REASON() { return 'Aproved reason'; }

	static get YES() { return 'Y'; }
	static get NO() { return 'N'; }
	static get WORK_OF_OFFICE_TC() { return 'workofoffice'; }
	static get MY_OWN_BUSINESS_TC() { return 'myownbusiness'; }
	static get APPROVED_REASON_TC() { return 'approvedreason'; }

	static get defaultInTime() { return '09:00'; }

	static get Actions() { return 'Actions'; }
	static get Companies() { return 'Companies'; }
	static get Add_Company() { return 'Add Company'; }
	static get Delete_Company() { return 'Delete Company'; }
	static get Admins() { return 'Admins'; }
	static get Add_Admin() { return 'Add Admin'; }
	static get Delete_Admin() { return 'Delete Admin'; }

	static get Employee_Settings() { return 'Employee Settings'; }
	static get Add_Employee() { return 'Add Employee'; }
	static get Delete_Employee() { return 'Delete Employee'; }
	static get Detach_Employee() { return 'Detach Employee'; }

	static get Custom_Late_Times() { return 'Custom Late times'; }
	static get Custom_Work_Hours() { return 'Custom Work hours'; }
	static get Make_Attendance() { return 'Make attendance'; }
	static get Delete_Attendance() { return 'Delete attendance'; }

	static get Add_Custom_Late_Time() { return 'Add New Time'; }
	static get Delete_Custom_Late_Time() { return 'Delete Time'; }
	static get Delete_All_Custom_Late_Time() { return 'Delete All Late Times'; }

	static get Add_Custom_Work_Hour() { return 'Add New Work Day Hours'; }
	static get Delete_Custom_Work_Hour() { return 'Delete Work Day Hours'; }
	static get Delete_All_Custom_Work_Hour() { return 'Delete All Work Day Hours'; }

	static get Monday() { return 'Monday'; }
	static get Tuesday() { return 'Tuesday'; }
	static get Wednesday() { return 'Wednesday'; }
	static get Thursday() { return 'Thursday'; }
	static get Friday() { return 'Friday'; }
	static get Saturday() { return 'Saturday'; }
	static get Sunday() { return 'Sunday'; }
}

module.exports = Pref;
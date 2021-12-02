class Employee {
	constructor(employee_id, company_id) {
		this.employee_id = employee_id;
		this.company_id = company_id;
	}
}

class Attendance {
	constructor(employee_id, company_id, date) {
		this.employee_id = employee_id;
		this.company_id = company_id;
		this.date = date;
	}
}

class Attendance_Info {
	constructor(attendance_id, action, time, status, reason) {
		this.attendance_id = attendance_id;
		this.action = action;
		this.time = time;
		this.status = status;
		this.reason = reason;
	}
}


module.exports = Employee;
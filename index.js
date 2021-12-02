//create telegram bot for control the company
//every day bot takes attendance of employees
//working day start from 9:00 am
//working day end at 6:00 pm
//employee might be last 15 minutes of working day
//if employee is absent then he/she will be marked as absent
//if employee is late then he/she will be marked as late
//if employee leave early bot must ask him/her reason
//every end day bot will send a report to admin
//admin can see the report of every employee
//admin can generate a report excel file
//admin can announce to all employees
//admin can send a message to all employees

//create database json file
//import db.json file


//start telegraf bot
const Telegraf= require('telegraf');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const session = require('telegraf/session');

const _ = require('underscore');
const dquery = require('./db/dquery.js');
const pref = require('./pref.js');
const util = require('./util.js');
require('dotenv').config();
let chatId;

process.on('uncaughtException', (err, origin) => {
    console.error('\n');console.error(err);
    bot.telegram.sendMessage(chatId, err.message, Markup.keyboard([[pref.BACK]]).resize().extra());
});

const bot = new Telegraf(process.env.BOT_TOKEN);

const admin_steps = [
    'actions',
    'actions2',
    'add_company',
    'delete_company',
    'add_admin',
    'delete_admin',
    'employee_settings',
    'add_employee',
    'delete_employee',
    'detach_employee',
    'employee_setting',
    'employee_actions',
    'custom_work_hours',
    'custom_late_times',
    'make_attendance',
    'delete_attendance',
    'add_custom_late_time',
    'delete_custom_late_time',
    'custom_work_hours_week',
    'custom_work_hours_time',
    'delete_custom_work_hour',
    'add_custom_work_hours',
    'make_attendance_save'
];

const steps = [
    'company',
    'employee',
    'register',
    'attendance',
    'check',
    'not_in_time',
    'not_in_time_reason'
];

const reg_steps = [
    'choose_from_another_company',
    'in_this_list',
    'not_in_this_list',
    'register'
];

const admin_actions = [[pref.Companies, pref.Add_Company, pref.Delete_Company], 
                       [pref.Admins, pref.Add_Admin, pref.Delete_Admin]];

//start session
bot.use(session());


//bot launch
bot.start(ctx => {
    chatId = ctx.chat.id;
    console.log(ctx.from.id);
    console.log('session ' + ctx.session);

    if (ctx.from.id == process.env.TURNIKET_ID) {
        dquery.getAllCompanies().then(res => {
            ctx.reply('Please choose your company:', Markup.keyboard([_.pluck(res, 'name')]).resize().extra());
            ctx.session.step = steps.indexOf('employee');
        });
    } else {
        dquery.getAllAdmins().then(res => {
            if (_.contains(res, ctx.from.id)) {
                ctx.reply('Hello Admin!. Please choose your action.', 
                        Markup.keyboard(admin_actions).resize().extra());
                ctx.session.admin = true;
                ctx.session.last_step = 0;
                ctx.session.admin_step = admin_steps.indexOf('actions2');

            } else {
                // ctx.reply('You are not authorized to use this bot');
                dquery.getAllCompanies().then(res => {
                    ctx.reply('Please choose your company:', Markup.keyboard([_.pluck(res, 'name')]).resize().extra());
                    ctx.session.step = steps.indexOf('employee');
                });
            }
        });
    }
});

function doAttendance(ctx, msg) {
    dquery.getEmployee(msg)
      .then((result) => {
        ctx.reply('Choose action', Markup.keyboard([[pref.CHECK_IN, pref.CHECK_OUT], [pref.BACK]]).resize().extra());
        ctx.session.employee = result;
        ctx.session.step = steps.indexOf('check');
    });
}
    
function onRegister(ctx) {
    let msg = ctx.message.text;
    console.log('reg_step: ' + ctx.session.reg_step);
    switch (reg_steps[ctx.session.reg_step]) {
        case 'choose_from_another_company':
            dquery.getCompanyEmployees(ctx.session.company.company_id, true).then((res) => {
                if (res.length) {
                    ctx.reply(`Choose yourself from other companies' employees!`,
                        Markup.keyboard([ res, [pref.REG_NOT_IN_THIS_LIST]]).oneTime().resize());
                    ctx.session.reg_step = reg_steps.indexOf('in_this_list');
                } else {
                    ctx.reply('Enter your full name', Markup.keyboard([[pref.BACK]]).resize().extra());
                    ctx.session.reg_step = reg_steps.indexOf('register');
                }
            });
            break;
         case 'in_this_list':
            dquery.getEmployee(msg).then((res) => {
                dquery.saveCompanyEmployee({company_id: ctx.session.company.company_id,employee_id: res.employee_id }, 
                () => {
                    ctx.session.employee = { employee_id: res.employee_id, name: msg };
                    ctx.reply(`You are assigned to '${ctx.session.company.name}'.`);
                    ctx.session.reg_step = '';
                    ctx.reply('Choose attendance action', Markup.keyboard([pref.CHECK_IN, pref.CHECK_OUT], [pref.BACK]));
                });
            });
            break;
        case 'not_in_this_list':
            ctx.reply('Enter your full name');
            ctx.session.reg_step = reg_steps.indexOf('register');
            break;
        case 'register':
            dquery.saveEmployee(msg).then(() => {
                console.log('saveEmployee');
                dquery.getEmployee(msg).then(res => {
                    console.log('getEmployee', res, ctx.session);
                    dquery.saveCompanyEmployee({ company_id: ctx.session.company.company_id, 
                                                 employee_id: res.employee_id }).then(
                    () => {
                        console.log('saveCompanyEmployee');
                        ctx.reply(`You are registered and assigned to '${ctx.session.company.name}'.`);
                        ctx.session.reg_step = '';
                        doAttendance(ctx, msg);
                    });
                });
                
            });
            break;
        default:
            break;
    }
}

function handleUserInput(ctx, msg) {
    if (msg == pref.REG_EMPLOYEE) {
        ctx.session.reg_step = 0;
        ctx.session.step = steps.indexOf('register');
    }

    if (msg == pref.BACK) { 
        if (ctx.session.step == steps.indexOf('register')) {
            ctx.session.reg_step = '';
            ctx.session.step--;
        } else if (ctx.session.step > steps.indexOf('register')) {
            ctx.session.step -= 3;
        } else ctx.session.step -= 2;
    }
    // console.log(ctx.session.reg_step + ' : ' + ctx.session.step);
    onRegister(ctx);

    if (steps[ctx.session.step] == 'register') {
        return;
    }

    switch (steps[ctx.session.step]) {
        case 'company':
            dquery.getAllCompanies().then(res => {
                ctx.reply('Please choose your company:', Markup.keyboard([_.pluck(res, 'name')]).resize().extra());
                ctx.session.step = steps.indexOf('employee');
            });
            break;
        case 'employee':
            dquery.getCompany((ctx.session.company || {}).name || msg).then((comp) => {
                dquery.getCompanyEmployees(comp.company_id).then(res => {
                    ctx.reply('Choose yourself from employee list. If you are not in the list, then register yourself', 
                    Markup.keyboard([..._.map(res, k => [k]), [pref.REG_EMPLOYEE, pref.BACK]]).resize().extra());
                    ctx.session.company = comp;
                    ctx.session.step = steps.indexOf('attendance');
                });
            });
            break;
        case 'attendance':
            doAttendance(ctx, msg);
            break;
        case 'check':
            ctx.session.action = msg.toLowerCase();
            let now = util.now();
            ctx.session.dateTime = now;
            switch(msg) {
                case pref.CHECK_IN:
                    util.checkInput(ctx.session.employee.employee_id)
                        .then((res) => {
                            if (res.is_in_time == pref.NO) {
                                let message = 'You are late for ' + (res.lateHours > 0 ? res.lateHours + ' hours, ' : '') +
                                    (res.lateMinutes > 0 ? res.lateMinutes + ' minutes' : '') + 
                                    '!. Please choose your reason for lateness.';
                                ctx.reply(message, Markup.keyboard([
                                    [pref.WORK_OF_OFFICE, pref.MY_OWN_BUSINESS, pref.APPROVED_REASON],
                                    [pref.BACK]
                                ]).resize().extra());
                                ctx.session.step = steps.indexOf('not_in_time');
                                ctx.session.penalty = res.penaltyHours;
                            } else {
                                data = { attendance: { employee_id: ctx.session.employee.employee_id, 
                                                           company_id: ctx.session.company.company_id,
                                                           date: now.date },
                                            attendance_info: { action: ctx.session.action, time: now.time, 
                                                               is_in_time: pref.YES }};
                                util.saveAttendance(ctx, data);
                            }
                        });
                    break;
                case pref.CHECK_OUT:
                    ctx.session.penalty = '';
                    let res = util.checkOutput();
                    if (res.is_in_time == 'N') {
                        let message = 'You are leaving early for ' + (res.earlyHours > 0 ? res.earlyHours + ' hours, ' : '') +
                            (res.earlyMinutes > 0 ? res.earlyMinutes + ' minutes' : '') + 
                            '!. Please choose your reason for leaving early.';
                        ctx.reply(message, Markup.keyboard([
                            [pref.WORK_OF_OFFICE, pref.MY_OWN_BUSINESS, pref.APPROVED_REASON],
                            [pref.BACK]
                        ]).resize().extra());
                        ctx.session.step = steps.indexOf('not_in_time');
                    } else {
                        data = { attendance: { employee_id: ctx.session.employee.employee_id, 
                                                   company_id: ctx.session.company.company_id,
                                                   date: now.date },
                                attendance_info: { action: ctx.session.action, time: now.time, 
                                                   is_in_time: pref.YES }};
                        util.saveAttendance(ctx, data);
                    }
                    break;
            }
            break;
        case 'not_in_time':
            if (msg == pref.APPROVED_REASON) {
                ctx.reply('Please write your approved reason.', Markup.keyboard([[pref.BACK]]).resize().extra());
                ctx.session.step = steps.indexOf('not_in_time_reason');
            } else {
                data = { attendance: { employee_id: ctx.session.employee.employee_id, 
                                           company_id: ctx.session.company.company_id,
                                           date: ctx.session.dateTime.date }};
                if (msg == pref.WORK_OF_OFFICE) {
                    data.attendance_info = { action: ctx.session.action,
                                             time: ctx.session.dateTime.time,
                                             is_in_time: pref.NO,
                                             reason: pref.WORK_OF_OFFICE_TC };
                } else {
                    data.attendance_info = { action: ctx.session.action,
                                             time: ctx.session.dateTime.time, 
                                             is_in_time: pref.NO,
                                             reason: pref.MY_OWN_BUSINESS_TC,
                                             penalty: ctx.session.penalty };
                }
                util.saveAttendance(ctx, data);
                ctx.session = {};
                ctx.session.step = 0;
            }
            break;
        case 'not_in_time_reason':
            data = { attendance: { employee_id: ctx.session.employee.employee_id, 
                                                    company_id: ctx.session.company.company_id,
                                                    date: ctx.session.dateTime.date },
                                 attendance_info: { action: ctx.session.action,
                                                    time: ctx.session.dateTime.time, 
                                                    is_in_time: pref.NO,
                                                    reason: pref.APPROVED_REASON_TC,
                                                    user_reason: msg.trim().replace(`'`, `''`) }};
            util.saveAttendance(ctx, data);
            ctx.session = {};
            ctx.session.step = 0;
            break;
        default:
            break;
    }
}

function handleAdminInput(ctx, msg) {
    if (msg == pref.BACK) { 
        ctx.session.admin_step = ctx.session.last_step;
    }

    let args, param, data;

    const employee_actions = [[pref.Employee_Settings, pref.Add_Employee], 
                              [pref.Delete_Employee, pref.Detach_Employee],
                              [pref.BACK]];

    switch(admin_steps[ctx.session.admin_step]) {
        case 'actions':
            ctx.reply('Hello Admin!. Please choose your action.', 
                Markup.keyboard(admin_actions).resize().extra());
            ctx.session = {};
            ctx.session.admin = true;
            ctx.session.last_step = 0;
            ctx.session.admin_step = admin_steps.indexOf('actions2');
            break;
        case 'actions2':
            ctx.session.last_step = admin_steps.indexOf('actions');
            switch(msg) {
                case pref.Companies:
                    ctx.reply('Companies:', 
                            Markup.keyboard([[pref.Add_Company, pref.Delete_Company], [pref.BACK]]).resize().extra());
                    dquery.getAllCompanies().then(res => {
                        _.each(res, cmp => {
                            ctx.reply(cmp.name, Markup.inlineKeyboard([
                                Markup.callbackButton('Employees', `employees--${ cmp.company_id }`),
                                Markup.callbackButton('Report', `report--${ cmp.company_id }`)
                            ]).extra());
                        });
                    });
                    break;
                case pref.Add_Company:
                    ctx.reply('Enter company name', Markup.keyboard([[pref.BACK]]).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('add_company');
                    break;
                case pref.Delete_Company:
                    dquery.getAllCompanies().then(res => {
                        console.log(res);
                        ctx.reply('Choose company to delete',
                                Markup.keyboard([..._.map(res, x => [`'${x.name}'`]), [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('delete_company');
                    });
                    break;
                case pref.Admins:
                    ctx.reply('Admins:', Markup.keyboard([[pref.Add_Admin, pref.Delete_Admin], [pref.BACK]]).resize().extra());
                    dquery.getAllAdmins().then(res => {
                        _.each(res, a => ctx.reply(a));
                    });
                    break;
                case pref.Add_Admin:
                    ctx.reply('Enter admin telegram user_id to save', Markup.keyboard([[pref.BACK]]).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('add_admin');
                    break;
                case pref.Delete_Admin:
                    dquery.getAllAdmins().then(res => {
                        ctx.reply('Choose admin to delete', 
                                Markup.keyboard([..._.map(res, x => [`'${x}'`]), [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('delete_admin');
                    });
                    break;
                default: break;
            }
            break;
        case 'add_company':
            ctx.session.last_step = admin_steps.indexOf('actions');
            dquery.saveCompany(msg).then(() => {
                ctx.reply('Company saved', 
                    Markup.keyboard(admin_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('actions2');
            });
            break;
        case 'delete_company':
            ctx.session.last_step = admin_steps.indexOf('actions');
            dquery.deleteCompany(msg.replace(/'/g, '')).then(() => {
                ctx.reply('Company deleted',
                    Markup.keyboard(admin_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('actions2');
            });
            break;
        case 'add_admin':
            ctx.session.last_step = admin_steps.indexOf('actions');
            dquery.saveAdmin(msg).then(() => {
                ctx.reply('Admin saved', 
                    Markup.keyboard(admin_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('actions2');
            });
            break;
        case 'delete_admin':
            ctx.session.last_step = admin_steps.indexOf('actions');
            dquery.deleteAdmin(msg.replace(/'/g, '')).then(() => {
                ctx.reply('Admin deleted',
                    Markup.keyboard(admin_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('actions2');
            });
            break;
        case 'employee_settings':
            ctx.session.last_step = admin_steps.indexOf('actions');
            switch(msg) {
                case pref.Employee_Settings:
                    dquery.getCompanyEmployees(ctx.session.company_id).then(res => {
                        ctx.reply('Choose an employee',
                            Markup.keyboard([..._.map(res, k => [k]), [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('employee_setting');
                    });
                    break;
                case pref.Add_Employee:
                    dquery.getCompanyEmployees(ctx.session.company_id, true).then(res => {
                        ctx.reply('Choose an employee to add to this company. If employee is not in the list please write employee full name.',
                            Markup.keyboard([..._.map(res, k => [k]), [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('add_employee');
                    });
                    break;
                case pref.Delete_Employee:
                    dquery.getCompanyEmployees(ctx.session.company_id).then(res => {
                        let emps = _.map(res, k => [k]);
                        if (!emps.length) ctx.reply('Employees not found for this company', Markup.keyboard([[pref.BACK]]).resize().extra());
                        else { 
                            ctx.reply('Choose an employee to delete',
                                    Markup.keyboard([...emps, [pref.BACK]]).resize().extra());
                            ctx.session.admin_step = admin_steps.indexOf('delete_employee');
                        }
                    });
                    break;
                case pref.Detach_Employee:
                    dquery.getCompanyEmployees(ctx.session.company_id).then(res => {
                        ctx.reply('Choose an employee to detach from this company',
                            Markup.keyboard([..._.map(res, k => [k]), [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('detach_employee');
                    });
                    break;
            }   
            break;
        case 'add_employee':
            ctx.session.last_step = admin_steps.indexOf('actions2');
            dquery.getAllEmployees().then(res => {
                ctx.session.admin_step = admin_steps.indexOf('employee_settings');
                if ((emp = _.find(res, x => x.name == msg))) {
                    dquery.saveCompanyEmployee({ company_id: ctx.session.company_id, 
                                                 employee_id: emp.employee_id }).then(
                    () => {
                        ctx.reply(`Employee ${msg} attached to this company.`, 
                            Markup.keyboard(employee_actions).resize().extra());
                    });
                } else {
                    dquery.saveEmployee(msg).then(() => {
                        dquery.getEmployee(msg).then(res => {
                            dquery.saveCompanyEmployee({ company_id: ctx.session.company_id, 
                                                         employee_id: res.employee_id }).then(
                            () => {
                                ctx.reply(`Employee ${msg} registered and added to this company`, 
                                    Markup.keyboard(employee_actions).resize().extra());
                            });
                        });
                    });
                }
            });
            break;
        case 'delete_employee':
            ctx.session.last_step = admin_steps.indexOf('actions2');
            dquery.deleteEmployee(msg).then(res => {
                ctx.reply(`Employee ${msg} deleted totally.`, 
                        Markup.keyboard(employee_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('employee_settings');
            });
            break;
        case 'detach_employee':
            ctx.session.last_step = admin_steps.indexOf('actions2');
            dquery.getEmployee(msg).then(res => {
                dquery.detachCompanyEmployee({ company_id: ctx.session.company_id, employee_id: res.employee_id }).then(() => {
                    ctx.reply(`Employee ${msg} deleted from this company.`, 
                            Markup.keyboard(employee_actions).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('employee_settings');
                });
            });
            break;
        case 'employee_setting':
            ctx.session.last_step = admin_steps.indexOf('actions');
            if (ctx.session.employee_id) {
                util.getEmployeeInfo(ctx, ctx.session.company_id, ctx.session.employee_id, ctx.session.employee_name);
            } else {
                dquery.getEmployee(msg).then(res => {
                    ctx.tg.deleteMessage(ctx.chat.id, ctx.message.message_id);
                    ctx.session.employee_id = res.employee_id;
                    ctx.session.employee_name = res.name;
                    util.getEmployeeInfo(ctx, ctx.session.company_id, ctx.session.employee_id, ctx.session.employee_name);
                });
            }
            ctx.session.admin_step = admin_steps.indexOf('employee_actions');
            break;
        case 'employee_actions':
            ctx.session.last_step = admin_steps.indexOf('employee_setting');
            switch(msg == pref.BACK ? ctx.session.prev_emp_action : msg) {
                case pref.Custom_Late_Times:
                    ctx.reply('Choose an action:',
                                Markup.keyboard([[pref.Add_Custom_Late_Time, pref.Delete_Custom_Late_Time, 
                                                  pref.Delete_All_Custom_Late_Time], [pref.BACK]
                                                ]).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('custom_late_times');
                    break;
                case pref.Custom_Work_Hours:
                    ctx.reply('Choose an action:',
                                Markup.keyboard([[pref.Add_Custom_Work_Hour, pref.Delete_Custom_Work_Hour, 
                                                  pref.Delete_All_Custom_Work_Hour], [pref.BACK]
                                                ]).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('custom_work_hours');
                    break;
                case pref.Make_Attendance:
                    dquery.getEmployeeAbcences(ctx.session.company_id, ctx.session.employee_id).then(res => {
                        ctx.reply('Choose date from employee absences in this month:',
                                    Markup.keyboard([...res, [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('make_attendance');
                    });
                    break;
                case pref.Delete_Attendance:
                    dquery.getEmployeeAttendances(ctx.session.company_id, ctx.session.employee_id).then(res => {
                        ctx.reply('Choose a date from attendance dates in this month:', 
                                Markup.keyboard([..._.map(res, x => [x]), [pref.BACK]]).resize().extra());
                    });
                    ctx.session.admin_step = admin_steps.indexOf('delete_attendance');
                    break;
            }
            if (msg != pref.BACK) ctx.session.prev_emp_action = msg;
            break;
        case 'custom_late_times':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            switch(msg) {
                case pref.Add_Custom_Late_Time:
                    ctx.reply(`Please write start time and end time and penalty 
                               hours with space between them. Ex. 09:15 09:30 1`, Markup.keyboard([[pref.BACK]]).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('add_custom_late_time');
                    break;
                case pref.Delete_Custom_Late_Time:
                    dquery.getEmployeeCustomLateTimes(ctx.session.company_id, ctx.session.employee_id).then((res) => {
                        let times = _.map(res, x => [`${x[0]}-${x[1]} penalty: ${x[2]}`]);
                        ctx.reply('Choose a custom late time to delete', Markup.keyboard([...times, [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('delete_custom_late_time');
                    });
                    break;
                case pref.Delete_All_Custom_Late_Time:
                    dquery.deleteAllEmployeeCustomLateTimes(ctx.session.company_id, ctx.session.employee_id).then(() => {
                        ctx.reply('All custom late times are deleted.', Markup.keyboard([[pref.BACK]]).resize().extra());
                    });
                    break;
            }
            break;
        case 'add_custom_late_time':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            args = msg.split(/\s+/);
            param = { company_id: ctx.session.company_id, employee_id: ctx.session.employee_id, 
                start_time: args[0], end_time: args[1], penalty: args[2]};

            dquery.saveEmployeeCustomLateTime(param).then(() => {
                ctx.reply('Custom late time saved.', Markup.keyboard([[pref.BACK]]).resize().extra());
            });
            break;
        case 'delete_custom_late_time':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            let regex = /(.+)-(.{5}).+/g;
            args = regex.exec(msg); args.shift();
            param = { company_id: ctx.session.company_id, employee_id: ctx.session.employee_id, 
                          start_time: args[0], end_time: args[1] };
            dquery.deleteEmployeeCustomLateTime(param).then(() => {
                ctx.reply('Custom late time deleted.', Markup.keyboard([[pref.BACK]]).resize().extra());
            });
            break;
        case 'custom_work_hours':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            switch(msg) {
                case pref.Add_Custom_Work_Hour:
                    ctx.reply('Choose a day of week',
                            Markup.keyboard([[pref.Monday, pref.Tuesday, pref.Wednesday, pref.Thursday,
                                              pref.Friday, pref.Saturday, pref.Sunday], [pref.BACK]]).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('custom_work_hours_week');
                    break;
                case pref.Delete_Custom_Work_Hour:
                    dquery.getEmployeeCustomWorkHours(ctx.session.company_id, ctx.session.employee_id).then((res) => {
                        ctx.reply('Choose a custom work hour to delete:', 
                                Markup.keyboard([...res, [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('delete_custom_work_hour');
                    });
                    break;
                case pref.Delete_All_Custom_Work_Hour:
                    dquery.deleteAllEmployeeCustomWorkHours(ctx.session.company_id, ctx.session.employee_id).then(() => {
                        ctx.reply('All custom work hours are deleted.', Markup.keyboard([[pref.BACK]]).resize().extra());
                    });
                    break;
            }
            break;
        case 'custom_work_hours_week':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            ctx.session.week_day = msg;
            ctx.reply('Write start time and end time with space between them. Ex: 09:00-18:00', 
                    Markup.keyboard([[pref.BACK]]).resize().extra());
            ctx.session.admin_step = admin_steps.indexOf('add_custom_work_hours');
            break;
        case 'add_custom_work_hours':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            args = msg.split('-');
            data = { company_id: ctx.session.company_id, employee_id: ctx.session.employee_id, 
                         week_day: ctx.session.week_day.substring(0, 3).toLowerCase(), in_time: args[0], out_time: args[1] };
            dquery.saveEmployeeCustomWorkHours(data).then(() => {
                ctx.session.week_day = '';
                ctx.reply('Custom work hours are saved for ' + ctx.session.week_day,
                        Markup.keyboard([[pref.BACK]]).resize().extra());
            });
            break;
        case 'delete_custom_work_hour':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            args = msg.split(/\s+/);
            let times = args[1].split('-');
            data = { company_id: ctx.session.company_id, employee_id: ctx.session.employee_id, 
                         week_day: args[0].substring(0, 3).toLowerCase(), in_time: times[0], out_time: times[1] };
            dquery.deleteEmployeeCustomWorkHours(data).then(() => {
                ctx.reply(`Custom work hour ${msg} is deleted for this employee`, 
                            Markup.keyboard([[pref.BACK]]).resize().extra());
            });
            break;
        case 'make_attendance':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            ctx.session.attendance_date = util.format(msg.replace(/`'`/g, ''));
            ctx.reply('Please enter worked hours for this employee', Markup.keyboard([[pref.BACK]]).resize().extra());
            ctx.session.admin_step = admin_steps.indexOf('make_attendance_save');
            break;
        case 'make_attendance_save':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            data = { company_id: ctx.session.company_id, employee_id: ctx.session.employee_id, 
                         date: ctx.session.attendance_date, hours: msg };
            util.makeAttendance(data).then(() => {
                ctx.reply(`Attendance for ${util.reformat(data.date)} is done for this employee`, 
                            Markup.keyboard([[pref.BACK]]).resize().extra());
            });
            break;
        case 'delete_attendance':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            dquery.deleteEmployeeAttendance(ctx.session.company_id, ctx.session.employee_id, 
                                            util.format(msg.split(/\s+/)[0])).then(() => {
                ctx.reply(`Attendance for ${msg} is deleted for this employee`, 
                            Markup.keyboard([[pref.BACK]]).resize().extra());
            });
            break;
        default:
            break;
    }
}

//bot on text message
bot.on('text', ctx => {
    let msg = ctx.message.text.trim();

    if (ctx.session.admin) {
        handleAdminInput(ctx, msg);
    } else {
        handleUserInput(ctx, msg);
    }
});

bot.action(/employees--(\d+)/, ctx => {
    var company_id = ctx.match[1];
    ctx.session.company_id = company_id;

    ctx.reply('Choose an action',
        Markup.keyboard([[pref.Employee_Settings, pref.Add_Employee], 
                         [pref.Delete_Employee, pref.Detach_Employee],
                         [pref.BACK]]).resize().extra());
    ctx.session.last_step = admin_steps.indexOf('actions');
    ctx.session.admin_step = admin_steps.indexOf('employee_settings');
});


bot.launch((err) => console.log(err));
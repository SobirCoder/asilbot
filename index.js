const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const session = require('telegraf/session');

const _ = require('underscore');
const dquery = require('./db/dquery.js');
const pref = require('./pref.js');
const util = require('./util.js');
const time_util = require('./time_util.js');
const moment = require('moment');
const report = require('./report.js')
require('dotenv').config();
let chatId;

process.on('uncaughtException', (err, origin) => {
    console.error('\n');console.error(err);
    bot.telegram.sendMessage(chatId, err.message, Markup.keyboard([[pref.BACK]]).resize().extra());
});

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

const admin_steps = [
    'actions',
    'actions2',
    'add_company',
    'delete_company',
    'add_admin',
    'delete_admin',
    'companies',
    'company_actions',
    'company_actions2',
    'report',
    'report_actions',
    'employees',
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

function onUserStartup(ctx) {
    dquery.getAllCompanies().then(res => {
        ctx.reply('Please choose your company:', 
                Markup.keyboard([..._.map(_.pluck(res, 'name'), x => [x])]).resize().extra());
        _.each(_.keys(ctx.session), k => ctx.session[k] = '');
        ctx.session.last_step = 0;
        ctx.session.step = steps.indexOf('employee');
    });
}

function doAttendance(ctx, msg) {
    dquery.getEmployee(ctx.session.company.company_id, msg)
      .then((res) => {
        let actions = ['in', 'out'], btns = [];
        if (!res.last_action) res.last_action = 'out';

        _.each(_.reject(actions, x => x == res.last_action), k => btns.push(pref['CHECK_' + k.toUpperCase()]));
        ctx.session.last_action = res.last_action;

        ctx.reply('Choose action', Markup.keyboard([btns, [pref.BACK]]).resize().extra());
        ctx.session.employee = res;
        ctx.session.step = steps.indexOf('check');
    });
}

function saveAttendance(ctx, data) {
    if (ctx.session.last_action == data.attendance_info.action ||
            ctx.session.last_step == null && data.attendance_info.action == 'out') {
        ctx.session.last_step = steps.indexOf('attendance');
        ctx.reply(`You can't do the same attendance action twice or you can't check out without check in!`,
                Markup.keyboard([[pref.BACK]]).resize().extra());
    } else {
        dquery.saveAttendance(data).then(() => {
            ctx.reply('Your attendance recorded. Thank you!');
            onUserStartup(ctx);
        });
    }
}

bot.start(ctx => {
    chatId = ctx.chat.id;
    
    dquery.foreignKeySupport().then(() => {
        if (ctx.from.id == process.env.TURNIKET_ID) {
            onUserStartup(ctx);
        } else {
            dquery.getAllAdmins().then(res => {
                if (_.contains(res, ctx.from.id)) {
                    ctx.reply('Hello Admin!. Please choose your action.', 
                            Markup.keyboard(admin_actions).resize().extra());
                    ctx.session.admin = true;
                    ctx.session.last_step = 0;
                    ctx.session.admin_step = admin_steps.indexOf('actions2');

                } else {
                    ctx.reply('You are not authorized to use this bot');
                    onUserStartup(ctx);
                }
            });
        }
    });
});
    
function onRegister(ctx) {
    let msg = ctx.message.text;
    ctx.session.is_initial_reg_step = false;

    if (msg == pref.REG_NOT_IN_THIS_LIST) {
        ctx.session.reg_step = reg_steps.indexOf('not_in_this_list');
    }

    switch (reg_steps[ctx.session.reg_step]) {
        case 'choose_from_another_company':
            ctx.session.last_step = steps.indexOf('employee');
            ctx.session.is_initial_reg_step = true;
            dquery.getOtherCompanyEmployees(ctx.session.company.company_id).then((res) => {
                if (res.length) {
                    ctx.reply(`Choose yourself from other companies' employees!`,
                        Markup.keyboard([ ...res, [pref.REG_NOT_IN_THIS_LIST, pref.BACK]]).resize().extra());
                    ctx.session.reg_step = reg_steps.indexOf('in_this_list');
                } else {
                    ctx.reply('Enter your full name', Markup.keyboard([[pref.BACK]]).resize().extra());
                    ctx.session.reg_step = reg_steps.indexOf('register');
                }
            });
            break;
         case 'in_this_list':
            ctx.session.last_reg_step = reg_steps.indexOf('choose_from_another_company');
            dquery.getEmployee(ctx.session.company.company_id, msg).then((res) => {
                dquery.saveCompanyEmployee({company_id: ctx.session.company.company_id,employee_id: res.employee_id }).then(() => {
                    ctx.reply(`You are assigned to '${ctx.session.company.name}'.`);
                    ctx.session.reg_step = '';
                    ctx.session.last_reg_step = '';
                    doAttendance(ctx, msg);
                });
            });
            break;
        case 'not_in_this_list':
            ctx.session.last_reg_step = reg_steps.indexOf('choose_from_another_company');
            ctx.reply('Enter your full name', Markup.keyboard([[pref.BACK]]).resize().extra());
            ctx.session.reg_step = reg_steps.indexOf('register');
            break;
        case 'register':
            ctx.session.last_step = steps.indexOf('employee');
            dquery.saveEmployee(msg).then(() => {
                dquery.getEmployee(ctx.session.company.company_id, msg).then(res => {
                    dquery.saveCompanyEmployee({ company_id: ctx.session.company.company_id, 
                                                 employee_id: res.employee_id }).then(() => {
                        ctx.reply(`You are registered and assigned to '${ctx.session.company.name}'.`);
                        ctx.session.reg_step = '';
                        ctx.session.last_reg_step = '';
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
        if (steps[ctx.session.step] == 'register') {
            if (ctx.session.is_initial_reg_step) {
                ctx.session.reg_step = '';
                ctx.session.last_reg_step = '';
                ctx.session.step = ctx.session.last_step
            } else ctx.session.reg_step = ctx.session.last_reg_step;
        } else ctx.session.step = ctx.session.last_step;
    }

    onRegister(ctx);

    if (steps[ctx.session.step] == 'register') return;

    switch (steps[ctx.session.step]) {
        case 'company':
            onUserStartup(ctx);
            break;
        case 'employee':
            ctx.session.last_step = steps.indexOf('company');
            dquery.getCompany((ctx.session.company || {}).name || msg).then((comp) => {
                dquery.getCompanyEmployees(comp.company_id).then(res => {
                    ctx.reply('Choose yourself from employee list. If you are not in the list, then register yourself', 
                            Markup.keyboard([...res, [pref.REG_EMPLOYEE, pref.BACK]]).resize().extra());
                    ctx.session.company = comp;
                    ctx.session.step = steps.indexOf('attendance');
                });
            });
            break;
        case 'attendance':
            ctx.session.last_step = steps.indexOf('employee');
            doAttendance(ctx, msg != pref.BACK ? msg : ctx.session.last_emp);
            if (msg != pref.BACK) ctx.session.last_emp = msg;
            break;
        case 'check':
            ctx.session.last_step = steps.indexOf('attendance');
            let now = util.now();
            ctx.session.dateTime = now;
            ctx.session.action = (msg != pref.BACK ? msg : ctx.session.last_check).toLowerCase();
            switch(msg != pref.BACK ? msg : ctx.session.last_check) {
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
                                saveAttendance(ctx, data);
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
                        saveAttendance(ctx, data);
                    }
                    break;
            }
            if (msg != pref.BACK) ctx.session.last_check = msg;
            break;
        case 'not_in_time':
            ctx.session.last_step = steps.indexOf('check');
            let message = msg != pref.BACK ? msg : ctx.session.last_nit;        

            if (message == pref.APPROVED_REASON) {
                ctx.reply('Please write your approved reason.', Markup.keyboard([[pref.BACK]]).resize().extra());
                ctx.session.step = steps.indexOf('not_in_time_reason');
            } else {
                data = { attendance: { employee_id: ctx.session.employee.employee_id, 
                                           company_id: ctx.session.company.company_id,
                                           date: ctx.session.dateTime.date }};
                if (message == pref.WORK_OF_OFFICE) {
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
                saveAttendance(ctx, data);
            }
            if (msg != pref.BACK) ctx.session.last_nit = msg;
            break;
        case 'not_in_time_reason':
            ctx.session.last_step = steps.indexOf('not_in_time');
            data = { attendance: { employee_id: ctx.session.employee.employee_id, 
                                                    company_id: ctx.session.company.company_id,
                                                    date: ctx.session.dateTime.date },
                                 attendance_info: { action: ctx.session.action,
                                                    time: ctx.session.dateTime.time, 
                                                    is_in_time: pref.NO,
                                                    reason: pref.APPROVED_REASON_TC,
                                                    user_reason: msg.trim().replace(`'`, `''`) }};
            saveAttendance(ctx, data);
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
            switch(msg != pref.BACK ? msg : ctx.session.last_action) {
                case pref.Companies:
                    dquery.getAllCompanies().then(res => {
                        ctx.reply('Choose a company:', 
                                Markup.keyboard([..._.map(res, x => [`'${x.name}'`]), [pref.BACK]]).resize().extra());
                        ctx.session.company_id = '';
                        ctx.session.company_name = '';
                        ctx.session.admin_step = admin_steps.indexOf('company_actions');
                    });
                    break;
                case pref.Add_Company:
                    ctx.reply('Enter company name', Markup.keyboard([[pref.BACK]]).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('add_company');
                    break;
                case pref.Delete_Company:
                    dquery.getAllCompanies().then(res => {
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
            if (msg != pref.BACK) ctx.session.last_action = msg;
            break;
        case 'add_company':
            ctx.session.last_step = admin_steps.indexOf('actions2');
            dquery.saveCompany(msg).then(() => {
                ctx.reply('Company saved', 
                    Markup.keyboard(admin_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('actions2');
            });
            break;
        case 'delete_company':
            ctx.session.last_step = admin_steps.indexOf('actions2');
            dquery.deleteCompany(msg.replace(/'/g, '')).then(() => {
                ctx.reply('Company deleted',
                    Markup.keyboard(admin_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('actions2');
            });
            break;
        case 'add_admin':
            ctx.session.last_step = admin_steps.indexOf('actions2');
            dquery.saveAdmin(msg).then(() => {
                ctx.reply('Admin saved', 
                    Markup.keyboard(admin_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('actions2');
            });
            break;
        case 'delete_admin':
            ctx.session.last_step = admin_steps.indexOf('actions2');
            dquery.deleteAdmin(msg.replace(/'/g, '')).then(() => {
                ctx.reply('Admin deleted',
                    Markup.keyboard(admin_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('actions2');
            });
            break;
        case 'company_actions':
            ctx.session.last_step = admin_steps.indexOf('actions2');
            msg = msg.replace(/'/g, '');
            dquery.getCompany(msg != pref.BACK ? msg : ctx.session.company_name).then(res => {
                ctx.session.company_id = res.company_id;
                ctx.session.company_name = res.name;
                ctx.session.admin_step = admin_steps.indexOf('company_actions2');

                ctx.reply('Choose an action:', 
                    Markup.keyboard([[pref.Employees, pref.Report], [pref.BACK]]).resize().extra());
            });
            break;
        case 'company_actions2':
            ctx.session.last_step = admin_steps.indexOf('company_actions');
            switch(msg != pref.BACK ? msg : ctx.session.last_ca) {
                case pref.Employees:
                    ctx.reply('Choose an action',
                            Markup.keyboard([[pref.Employee_Settings, pref.Add_Employee], 
                                             [pref.Delete_Employee, pref.Detach_Employee],
                                             [pref.BACK]]).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('employee_settings');
                    break;
                case pref.Report:
                    ctx.reply('Choose report interval:', 
                             Markup.keyboard([[pref.Current_Week_Report, pref.Last_Week_Report], 
                                             [pref.Current_Month_Report, pref.Last_Month_Report],
                                             [pref.BACK]]).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('report_actions');
                    break;
            }
            if (msg != pref.BACK) ctx.session.last_ca = msg;
            break;
        case 'report_actions':
            ctx.session.last_step = admin_steps.indexOf('company_actions');
            let from, to, verb, sub_day;
            switch(msg) {
                case pref.Current_Week_Report:
                    from = time_util.getMoment().startOf('week').add(1, 'days').format('YYYY.MM.DD');
                    to = time_util.getMoment().endOf('week').add(1, 'days').format('YYYY.MM.DD');
                    break;
                case pref.Last_Week_Report:
                    from = time_util.getMoment().startOf('week').subtract(6, 'days').format('YYYY.MM.DD');
                    to = time_util.getMoment().endOf('week').subtract(6, 'days').format('YYYY.MM.DD');
                    break;
                case pref.Current_Month_Report:
                    from = time_util.getMoment().startOf('month').format('YYYY.MM.DD');
                    to = time_util.getMoment().endOf('month').format('YYYY.MM.DD');
                    break;
                case pref.Last_Month_Report:
                    to = time_util.getMoment().startOf('month').subtract(1, 'days').format('YYYY.MM.DD');
                    from = time_util.getMoment(to, 'YYYY.MM.DD').startOf('month').format('YYYY.MM.DD');
                    break;
                default: break;
            }
            if (!!from && !!to) {
                report.getReport(bot, ctx.chat.id, { company_id: ctx.session.company_id, from, to });
            }
            break;
        case 'employee_settings':
            ctx.session.last_step = admin_steps.indexOf('company_actions2');
            ctx.session.employee_id = '';
            ctx.session.employee_name = '';
            switch(msg != pref.BACK ? msg : ctx.session.last_empsetting) {
                case pref.Employee_Settings:
                    dquery.getCompanyEmployees(ctx.session.company_id).then(res => {
                        ctx.reply('Choose an employee',
                            Markup.keyboard([...res, [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('employee_setting');
                    });
                    break;
                case pref.Add_Employee:
                    dquery.getOtherCompanyEmployees(ctx.session.company_id).then(res => {
                        ctx.reply(`Choose an other company's employee to add to this company.\n` +
                                  `If employee is not in the list please write employee full name.`,
                            Markup.keyboard([...res, [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('add_employee');
                    });
                    break;
                case pref.Delete_Employee:
                    dquery.getCompanyEmployees(ctx.session.company_id).then(res => {
                        if (!res.length) ctx.reply('Employees not found for this company', Markup.keyboard([[pref.BACK]]).resize().extra());
                        else { 
                            ctx.reply('Choose an employee to delete',
                                    Markup.keyboard([...res, [pref.BACK]]).resize().extra());
                            ctx.session.admin_step = admin_steps.indexOf('delete_employee');
                        }
                    });
                    break;
                case pref.Detach_Employee:
                    dquery.getCompanyEmployees(ctx.session.company_id).then(res => {
                        ctx.reply('Choose an employee to detach from this company',
                            Markup.keyboard([...res, [pref.BACK]]).resize().extra());
                        ctx.session.admin_step = admin_steps.indexOf('detach_employee');
                    });
                    break;
            }   
            if (msg != pref.BACK) ctx.session.last_empsetting = msg;
            break;
        case 'add_employee':
            ctx.session.last_step = admin_steps.indexOf('employee_settings');
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
                        dquery.getEmployee(ctx.session.company_id, msg).then(res => {
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
            ctx.session.last_step = admin_steps.indexOf('employee_settings');
            dquery.deleteEmployee(msg).then(res => {
                ctx.reply(`Employee ${msg} deleted totally.`, 
                        Markup.keyboard(employee_actions).resize().extra());
                ctx.session.admin_step = admin_steps.indexOf('employee_settings');
            });
            break;
        case 'detach_employee':
            ctx.session.last_step = admin_steps.indexOf('employee_settings');
            dquery.getEmployee(ctx.session.company.company_id, msg).then(res => {
                dquery.detachCompanyEmployee({ company_id: ctx.session.company_id, employee_id: res.employee_id }).then(() => {
                    ctx.reply(`Employee ${msg} deleted from this company.`, 
                            Markup.keyboard(employee_actions).resize().extra());
                    ctx.session.admin_step = admin_steps.indexOf('employee_settings');
                });
            });
            break;
        case 'employee_setting':
            ctx.session.last_step = admin_steps.indexOf('employee_settings');
            if (ctx.session.employee_id) {
                util.getEmployeeInfo(ctx, ctx.session.company_id, ctx.session.employee_id, ctx.session.employee_name);
            } else {
                dquery.getEmployee(ctx.session.company_id, msg).then(res => {
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
            switch(msg != pref.BACK ? msg : ctx.session.prev_emp_action) {
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
                    ctx.reply(`Please write start time and end time and penalty\n` +
                               `hours with space between them. Ex. 09:15 09:30 1`, Markup.keyboard([[pref.BACK]]).resize().extra());
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
            args = msg.split(/\s+|-/);
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
            ctx.reply('Write start time and end time with space between them. Ex: 09:00 18:00', 
                    Markup.keyboard([[pref.BACK]]).resize().extra());
            ctx.session.admin_step = admin_steps.indexOf('add_custom_work_hours');
            break;
        case 'add_custom_work_hours':
            ctx.session.last_step = admin_steps.indexOf('employee_actions');
            args = msg.split(/\s+|-/);
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
            ctx.session.last_step = admin_steps.indexOf('employee_setting');
            data = { company_id: ctx.session.company_id, employee_id: ctx.session.employee_id, 
                         date: ctx.session.attendance_date, is_marked_by_admin: 'Y', hours: msg };
            util.makeAttendance(data).then(() => {
                ctx.reply(`Attendance for ${util.reformat(data.date)} is done for this employee`, 
                            Markup.keyboard([[pref.BACK]]).resize().extra());
            });
            break;
        case 'delete_attendance':
            ctx.session.last_step = admin_steps.indexOf('employee_setting');
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

bot.on('text', ctx => {
    chatId = ctx.chat.id;
    let msg = ctx.message.text.trim();
    if (ctx.session.admin) {
        handleAdminInput(ctx, msg);
    } else {
        handleUserInput(ctx, msg);
    }
});

bot.launch((err) => console.log(err));
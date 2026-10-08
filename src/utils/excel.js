const ExcelJS = require('exceljs')

const getEmployeeColumns = () => [
	{ header: 'ID', key: 'id', width: 24 },
	{ header: 'Employee Code', key: 'employee_code', width: 20 },
	{ header: 'First Name', key: 'first_name', width: 20 },
	{ header: 'Last Name', key: 'last_name', width: 20 },
	{ header: 'Email', key: 'email', width: 32 },
	{ header: 'Phone Number', key: 'phone_number', width: 20 },
	{ header: 'Department', key: 'department', width: 24 },
	{ header: 'Position', key: 'position', width: 24 },
	{ header: 'Status', key: 'status', width: 14 },
	{ header: 'Hire Date', key: 'hire_date', width: 18 },
	{ header: 'Address', key: 'address', width: 36 },
	{ header: 'Created At', key: 'created_at', width: 22 },
	{ header: 'Updated At', key: 'updated_at', width: 22 }
]

const createEmployeeWorksheet = (workbook, employees, escapeFormulas = false) => {
	const worksheet = workbook.addWorksheet('Employees')
	worksheet.columns = getEmployeeColumns()

	worksheet.addRows(
		employees.map((employee) => {
			const data = typeof employee.toJSON === 'function' ? employee.toJSON() : employee
			const row = {
				id: data.id,
				employee_code: data.employee_code,
				first_name: data.first_name,
				last_name: data.last_name,
				email: data.email,
				phone_number: data.phone_number,
				department: data.department?.name || data.department_name || '',
				position: data.position,
				status: data.status ? 'Active' : 'Inactive',
				hire_date: data.hire_date,
				address: data.address,
				created_at: data.created_at,
				updated_at: data.updated_at
			}

			if (escapeFormulas) {
				for (const [key, value] of Object.entries(row)) {
					if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
						row[key] = `'${value}`
					}
				}
			}

			return row
		})
	)

	return worksheet
}

const createEmployeeWorkbook = async (employees) => {
	const workbook = new ExcelJS.Workbook()
	const worksheet = createEmployeeWorksheet(workbook, employees)
	const header = worksheet.getRow(1)

	header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
	header.fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'FF1F4E78' }
	}
	worksheet.views = [{ state: 'frozen', ySplit: 1 }]
	worksheet.autoFilter = {
		from: 'A1',
		to: `${worksheet.getColumn(worksheet.columnCount).letter}1`
	}

	return workbook.xlsx.writeBuffer()
}

const createEmployeeCsv = async (employees) => {
	const workbook = new ExcelJS.Workbook()
	createEmployeeWorksheet(workbook, employees, true)

	const csv = await workbook.csv.writeBuffer({
		sheetName: 'Employees',
		dateFormat: 'YYYY-MM-DD'
	})

	return Buffer.concat([Buffer.from('\uFEFF'), csv])
}

module.exports = {
	createEmployeeWorkbook,
	createEmployeeCsv
}

const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const port = 3000;

// Подключение к базе данных db_equipwriteoff (для ввода данных)
const poolEquip = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_equipwriteoff',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Подключение к базе данных db_books (для выполнения запросов)
const poolBooks = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_books',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Храним описания запросов
let queryDescriptions = {
  total_cost: "Суммарная стоимость всех закупок из таблицы Purchases",
  max_purchase: "Максимальная стоимость закупки из таблицы Purchases",
  check_sum: "Проверка суммы закупок (выводит если сумма <1000 или >5000)"
};

// Функция для рендеринга таблиц
function renderTable(data) {
  if (!data || data.length === 0) return '<p class="no-data">Нет данных для отображения</p>';
  
  const headers = Object.keys(data[0]);
  let html = '<div class="table-container"><table><thead><tr>';
  
  headers.forEach(header => {
    html += `<th>${header}</th>`;
  });
  
  html += '</tr></thead><tbody>';
  
  data.forEach(row => {
    html += '<tr>';
    headers.forEach(header => {
      html += `<td>${row[header]}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  return html;
}

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Учет оборудования</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <div class="container">
        <header>
          <h1>Система учета оборудования</h1>
          <nav>
            <ul class="menu">
              <li><a href="/employees">Сотрудники</a></li>
              <li><a href="/equipment">Оборудование</a></li>
              <li><a href="/writeoffs">Списания</a></li>
              <li><a href="/queries">Запросы (DB_BOOKS)</a></li>
            </ul>
          </nav>
        </header>
      </div>
    </body>
    </html>
  `);
});

// Роуты для работы с сотрудниками (db_equipwriteoff)
app.get('/employees', async (req, res) => {
  try {
    const [employees] = await poolEquip.query('SELECT * FROM Employees');
    res.send(`
      <html><head>
        <title>Сотрудники</title>
        <link rel="stylesheet" href="/style.css">
      </head><body>
        <div class="container">
          <h1>Список сотрудников</h1>
          ${renderTable(employees)}
          <h2>Добавить сотрудника</h2>
          <form method="POST" action="/employees">
            <label>ID: <input type="number" name="employee_id" required></label>
            <label>Фамилия: <input type="text" name="last_name" required></label>
            <label>Имя: <input type="text" name="first_name" required></label>
            <label>Отчество: <input type="text" name="middle_name"></label>
            <label>Должность: <input type="text" name="position" required></label>
            <label>Отдел: <input type="text" name="department" required></label>
            <label>Дата приема: <input type="date" name="hire_date" required></label>
            <button type="submit">Добавить</button>
          </form>
          <a href="/">На главную</a>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`Ошибка: ${err.message}`);
  }
});

app.post('/employees', async (req, res) => {
  try {
    const { employee_id, last_name, first_name, middle_name, position, department, hire_date } = req.body;
    await poolEquip.query(
      'INSERT INTO Employees VALUES (?, ?, ?, ?, ?, ?, ?)',
      [employee_id, last_name, first_name, middle_name || null, position, department, hire_date]
    );
    res.redirect('/employees');
  } catch (err) {
    res.status(500).send(`Ошибка: ${err.message}`);
  }
});

// Роуты для работы с оборудованием (db_equipwriteoff)
app.get('/equipment', async (req, res) => {
  try {
    const [equipment] = await poolEquip.query(`
      SELECT e.*, CONCAT(emp.last_name, ' ', emp.first_name) AS responsible 
      FROM Equipment e
      JOIN Employees emp ON e.responsible_employee_id = emp.employee_id
    `);
    const [employees] = await poolEquip.query('SELECT employee_id, CONCAT(last_name, " ", first_name) AS name FROM Employees');
    
    res.send(`
      <html><head>
        <title>Оборудование</title>
        <link rel="stylesheet" href="/style.css">
      </head><body>
        <div class="container">
          <h1>Список оборудования</h1>
          ${renderTable(equipment)}
          <h2>Добавить оборудование</h2>
          <form method="POST" action="/equipment">
            <label>ID: <input type="number" name="equipment_id" required></label>
            <label>Название: <input type="text" name="equipment_name" required></label>
            <label>Тип: <input type="text" name="equipment_type" required></label>
            <label>Дата поступления: <input type="date" name="receipt_date" required></label>
            <label>Ответственный:
              <select name="responsible_employee_id" required>
                ${employees.map(emp => `<option value="${emp.employee_id}">${emp.name}</option>`).join('')}
              </select>
            </label>
            <label>Место установки: <input type="text" name="installation_location" required></label>
            <button type="submit">Добавить</button>
          </form>
          <a href="/">На главную</a>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`Ошибка: ${err.message}`);
  }
});

app.post('/equipment', async (req, res) => {
  try {
    const { equipment_id, equipment_name, equipment_type, receipt_date, responsible_employee_id, installation_location } = req.body;
    await poolEquip.query(
      'INSERT INTO Equipment VALUES (?, ?, ?, ?, ?, ?)',
      [equipment_id, equipment_name, equipment_type, receipt_date, responsible_employee_id, installation_location]
    );
    res.redirect('/equipment');
  } catch (err) {
    res.status(500).send(`Ошибка: ${err.message}`);
  }
});

// Роуты для работы со списаниями (db_equipwriteoff)
app.get('/writeoffs', async (req, res) => {
  try {
    const [writeoffs] = await poolEquip.query(`
      SELECT w.*, e.equipment_name, CONCAT(emp.last_name, ' ', emp.first_name) AS employee 
      FROM WriteOffs w
      JOIN Equipment e ON w.equipment_id = e.equipment_id
      JOIN Employees emp ON w.employee_id = emp.employee_id
    `);
    const [equipment] = await poolEquip.query('SELECT equipment_id, equipment_name FROM Equipment');
    const [employees] = await poolEquip.query('SELECT employee_id, CONCAT(last_name, " ", first_name) AS name FROM Employees');
    
    res.send(`
      <html><head>
        <title>Списания</title>
        <link rel="stylesheet" href="/style.css">
      </head><body>
        <div class="container">
          <h1>Список списаний</h1>
          ${renderTable(writeoffs)}
          <h2>Добавить списание</h2>
          <form method="POST" action="/writeoffs">
            <label>ID: <input type="number" name="writeoff_id" required></label>
            <label>Оборудование:
              <select name="equipment_id" required>
                ${equipment.map(eq => `<option value="${eq.equipment_id}">${eq.equipment_name}</option>`).join('')}
              </select>
            </label>
            <label>Причина: <textarea name="writeoff_reason" required></textarea></label>
            <label>Дата списания: <input type="date" name="writeoff_date" required></label>
            <label>Сотрудник:
              <select name="employee_id" required>
                ${employees.map(emp => `<option value="${emp.employee_id}">${emp.name}</option>`).join('')}
              </select>
            </label>
            <button type="submit">Добавить</button>
          </form>
          <a href="/">На главную</a>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`Ошибка: ${err.message}`);
  }
});

app.post('/writeoffs', async (req, res) => {
  try {
    const { writeoff_id, equipment_id, writeoff_reason, writeoff_date, employee_id } = req.body;
    await poolEquip.query(
      'INSERT INTO WriteOffs VALUES (?, ?, ?, ?, ?)',
      [writeoff_id, equipment_id, writeoff_reason, writeoff_date, employee_id]
    );
    res.redirect('/writeoffs');
  } catch (err) {
    res.status(500).send(`Ошибка: ${err.message}`);
  }
});

// Роуты для работы с запросами (db_books)
app.get('/queries', async (req, res) => {
  try {
    const [totalCost] = await poolBooks.query("CALL GetTotalCost()");
    const [maxPurchase] = await poolBooks.query("CALL GetMaxPurchaseCost()");
    const [checkSum] = await poolBooks.query("CALL CheckTotalSum()");
    
    res.send(`
      <html><head>
        <title>Запросы</title>
        <link rel="stylesheet" href="/style.css">
      </head><body>
        <div class="container">
          <h1>Результаты запросов (DB_BOOKS)</h1>
          <form method="POST" action="/update-descriptions">
            
            <section>
              <h2>Суммарная стоимость закупок</h2>
              <textarea name="total_cost" rows="3">${queryDescriptions.total_cost}</textarea>
              <div class="result">${renderTable(totalCost[0])}</div>
            </section>
            
            <section>
              <h2>Максимальная стоимость закупки</h2>
              <textarea name="max_purchase" rows="3">${queryDescriptions.max_purchase}</textarea>
              <div class="result">${renderTable(maxPurchase[0])}</div>
            </section>
            
            <section>
              <h2>Проверка суммы закупок</h2>
              <textarea name="check_sum" rows="3">${queryDescriptions.check_sum}</textarea>
              <div class="result">${renderTable(checkSum[0])}</div>
            </section>
            
            <button type="submit">Сохранить описания</button>
          </form>
          <a href="/">На главную</a>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`
      <div class="container error">
        <h2>Ошибка выполнения запросов</h2>
        <p>${err.message}</p>
        <p>Убедитесь, что:</p>
        <ul>
          <li>База данных db_books существует</li>
          <li>Таблица Purchases создана</li>
          <li>Хранимые процедуры созданы</li>
        </ul>
        <a href="/" class="back-link">На главную</a>
      </div>
    `);
  }
});

app.post('/update-descriptions', (req, res) => {
  queryDescriptions.total_cost = req.body.total_cost || queryDescriptions.total_cost;
  queryDescriptions.max_purchase = req.body.max_purchase || queryDescriptions.max_purchase;
  queryDescriptions.check_sum = req.body.check_sum || queryDescriptions.check_sum;
  res.redirect('/queries');
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
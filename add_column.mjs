import mysql from 'mysql2/promise';

async function addColumn() {
  const conn = await mysql.createConnection('mysql://root:VjEncCKEEnQjoPOwfPLpWIOvLHzbMvJm@sakura.proxy.rlwy.net:26201/railway');
  
  try {
    // تحقق لو العمود موجود
    const [cols] = await conn.query("SHOW COLUMNS FROM visits LIKE 'distanceToPrevBranchKm'");
    if (cols.length > 0) {
      console.log('✅ العمود موجود بالفعل!');
    } else {
      await conn.query('ALTER TABLE visits ADD COLUMN distanceToPrevBranchKm INT NULL AFTER status');
      console.log('✅ تم إضافة عمود distanceToPrevBranchKm بنجاح!');
    }
    
    // تحقق من الهيكل
    const [structure] = await conn.query('SHOW COLUMNS FROM visits');
    structure.forEach(c => console.log(c.Field, '-', c.Type, '-', c.Null));
  } finally {
    await conn.end();
  }
}

addColumn().catch(e => console.error('❌', e.message));

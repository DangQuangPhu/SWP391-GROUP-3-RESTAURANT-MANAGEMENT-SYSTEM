fetch("http://localhost:5001/api/staff/test-checkin/9999", { method: 'POST' })
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);

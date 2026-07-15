console.log('Testing fetch to google.com...');
fetch('https://google.com')
  .then(res => {
    console.log('Fetch to google.com SUCCESS! status:', res.status);
    
    console.log('Testing fetch to my.sepay.vn...');
    return fetch('https://my.sepay.vn');
  })
  .then(res => {
    console.log('Fetch to my.sepay.vn SUCCESS! status:', res.status);
  })
  .catch(err => {
    console.error('Fetch failed:', err);
  });

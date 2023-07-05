// script.js
fetch('./library/index_smp.html')
  .then(response => response.text())
  .then(data => {
    document.getElementById('externalContent').innerHTML = data;
  })
  .catch(error => console.error(error));

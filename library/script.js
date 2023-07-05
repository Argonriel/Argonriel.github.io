// script.js
fetch('index_clm.html')
  .then(response => response.text())
  .then(data => {
    document.getElementById('externalContent').innerHTML = data;
  })
  .catch(error => console.error(error));

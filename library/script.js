// script.js
fetch('index2.html')
  .then(response => response.text())
  .then(data => {
    document.getElementById('externalContent').innerHTML = data;
  })
  .catch(error => console.error(error));

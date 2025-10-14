fetch('http://localhost:5000/api/jobs')
  .then(response => response.json())
  .then(data => {
    const jobList = document.getElementById('job-list');
    data.forEach(job => {
      const div = document.createElement('div');
      div.classList.add('job');
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.marginBottom = '20px';
      div.innerHTML = `
        <div style="flex: 1;">
          <h2>${job.title}</h2>
          <p><strong>Empresa:</strong> ${job.company}</p>
          <p><strong>Ubicación:</strong> ${job.location}</p>
          <p>${job.description}</p>
          <button onclick="apply(${job.id})">Postularme</button>
        </div>
        <img src="${job.image_url}" alt="Imagen del trabajo" style="width:200px;height:200px;object-fit:cover;margin-left:20px;">
      `;
      jobList.appendChild(div);
    });
  })
  .catch(error => console.error('Error al cargar los empleos:', error));

function apply(jobId) {
  // Comprobar si hay usuario logueado en localStorage
  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch (e) {
      return null;
    }
  }

  const user = getCurrentUser();
  if (!user || !user.id) {
    // Aceptar -> iniciar sesión; Cancelar -> registrarse
    const goLogin = confirm('Necesitas iniciar sesión para postular. Pulsa Aceptar para iniciar sesión o Cancelar para registrarte.');
    if (goLogin) {
      // enviar next para volver e intentar postular automáticamente
      window.location.href = `/login.html?next=/index.html?apply=${jobId}`;
    } else {
      window.location.href = `/register?next=/index.html?apply=${jobId}`;
    }
    return;
  }

  const userId = user.id;
  fetch('http://localhost:5000/api/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, job_id: jobId })
  })
  .then(res => res.json())
  .then(data => alert(data.message))
  .catch(err => console.error(err));
}

// Si la página se abrió con ?apply=ID, intentar postular automáticamente cuando cargue
function getQueryParam(name) {
  try { const params = new URLSearchParams(window.location.search); return params.get(name); } catch (e) { return null; }
}

document.addEventListener('DOMContentLoaded', () => {
  const applyParam = getQueryParam('apply');
  if (applyParam) {
    const id = parseInt(applyParam, 10);
    if (!Number.isNaN(id)) {
      // pequeño retardo para asegurar que la UI cargue
      setTimeout(() => apply(id), 300);
    }
  }
});

(function() {
    'use strict';

    const API_URL = 'http://localhost:3000/api';
    const TOKEN_KEY = 'cartobox_jwt_token';
    const USER_KEY = 'cartobox_user_email';

    // UTILIDADES DE SESIÓN

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token, email) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, email);
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function isAuthenticated() {
        return !!getToken();
    }

    function cerrarSesion() {
        clearSession();
        mostrarLogin();
    }

    function authHeaders(extra = {}) {
        const token = getToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...extra
        };
    }

    async function fetchAuth(url, options = {}) {
        const response = await fetch(url, options);

        if (response.status === 401) {
            alert(' Tu sesión expiró. Por favor, inicia sesión nuevamente.');
            cerrarSesion();
            throw new Error('Sesión expirada');
        }

        return response;
    }

    // CONTROL DE PANTALLAS (LOGIN vs APP)
    
    const pantallaLogin = document.getElementById('pantallaLogin');
    const appContenido = document.getElementById('appContenido');

    function mostrarLogin() {
        pantallaLogin.classList.remove('d-none');
        pantallaLogin.classList.add('d-flex');
        appContenido.classList.add('d-none');
        appContenido.classList.remove('d-flex');
    }

    function mostrarApp() {
        pantallaLogin.classList.add('d-none');
        pantallaLogin.classList.remove('d-flex');
        appContenido.classList.remove('d-none');
        appContenido.classList.add('d-flex');

        const email = localStorage.getItem(USER_KEY);
        const usuarioEmailEl = document.getElementById('usuarioEmail');
        if (usuarioEmailEl && email) usuarioEmailEl.textContent = email;

        cargarInsumosAPI();
        cargarPedidos();
    }

    // LOGIN
  
    const formLogin = document.getElementById('formLogin');
    const loginError = document.getElementById('loginError');
    const btnLogin = document.getElementById('btnLogin');

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginError.classList.add('d-none');
            btnLogin.disabled = true;
            btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verificando...';

            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            try {
                const respuesta = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(data.error || 'Credenciales inválidas');
                }

                setToken(data.token, email);
                formLogin.reset();
                mostrarApp();

            } catch (error) {
                loginError.textContent = error.message;
                loginError.classList.remove('d-none');
            } finally {
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> Iniciar Sesión';
            }
        });
    }

    // LOGOUT

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm('¿Cerrar sesión?')) {
                cerrarSesion();
            }
        });
    }

    // INSTANCIAS DE MODALES
  
    const modalElement = document.getElementById('modalDetalleStock');
    const modalDetalle = modalElement ? new bootstrap.Modal(modalElement) : null;
    
    const modalEditarElement = document.getElementById('modalEditarProducto');
    const modalEditar = modalEditarElement ? new bootstrap.Modal(modalEditarElement) : null;

    const modalNuevoElement = document.getElementById('modalNuevoProducto');
    const modalNuevo = modalNuevoElement ? new bootstrap.Modal(modalNuevoElement) : null;

    // Elementos del modal detalle
    const modalNombre = document.getElementById('modalNombreProducto');
    const modalSKU = document.getElementById('modalSKU');
    const modalCategoria = document.getElementById('modalCategoria');
    const modalStock = document.getElementById('modalStock');
    const modalUbicacion = document.getElementById('modalUbicacion');
    const modalEstadoBadge = document.getElementById('modalEstadoBadge');

    // DELEGACIÓN DE EVENTOS DE TARJETAS 
   
    document.addEventListener('click', async (e) => {
        // VER DETALLE
        const btnDetalle = e.target.closest('.btn-detalle');
        if (btnDetalle && modalDetalle) {
            const data = btnDetalle.dataset;
            if (modalNombre) modalNombre.textContent = data.nombre || 'Sin descripción';
            if (modalSKU) modalSKU.textContent = `SKU: ${data.sku || 'N/A'}`;
            if (modalCategoria) modalCategoria.textContent = data.categoria || 'N/A';
            if (modalStock) modalStock.textContent = `${Number(data.stock || 0).toLocaleString()} ${data.unidad || 'pzas'}`;
            if (modalUbicacion) modalUbicacion.textContent = data.ubicacion || 'N/A';

            if (modalEstadoBadge) {
                modalEstadoBadge.textContent = data.estado || 'Indefinido';
                modalEstadoBadge.className = 'badge fs-6 px-3 py-2 mb-2 ';
                if (data.estado === 'Crítico') modalEstadoBadge.classList.add('bg-danger');
                else if (data.estado === 'Reorden') modalEstadoBadge.classList.add('bg-warning', 'text-dark');
                else modalEstadoBadge.classList.add('bg-success');
            }
            modalDetalle.show();
        }

        // EDITAR PRODUCTO
        const btnEditar = e.target.closest('.btn-editar');
        if (btnEditar && modalEditar) {
            const data = btnEditar.dataset;
            document.getElementById('edit-id').value = data.id;
            document.getElementById('edit-sku').value = data.sku;
            document.getElementById('edit-nombre').value = data.nombre;
            document.getElementById('edit-stock').value = data.stock;
            document.getElementById('edit-categoria').value = data.categoria;
            document.getElementById('edit-ubicacion').value = data.ubicacion;
            modalEditar.show();
        }

        // ELIMINAR PRODUCTO
        const btnEliminar = e.target.closest('.btn-eliminar');
        if (btnEliminar) {
            const idInsumo = btnEliminar.dataset.id;
            const cantidad = parseInt(btnEliminar.dataset.stock || '0', 10);
            const tarjetaPadre = btnEliminar.closest('article');

            if (confirm('¿Confirmas que deseas eliminar este insumo del inventario?')) {
                try {
                    const respuesta = await fetchAuth(`${API_URL}/products/${idInsumo}`, {
                        method: 'DELETE',
                        headers: authHeaders()
                    });

                    if (!respuesta.ok) {
                        const err = await respuesta.json();
                        throw new Error(err.error || 'Error al eliminar');
                    }

                    if (tarjetaPadre) tarjetaPadre.remove();
                    descontarMetricas(cantidad);
                    alert('Insumo eliminado exitosamente del servidor.');
                } catch (error) {
                    console.error('Error al eliminar:', error);
                    if (error.message !== 'Sesión expirada') {
                        alert(` Error: ${error.message}`);
                    }
                }
            }
        }
    });

    // DETECCIÓN DE CAMBIO DE ESTADO EN LA TABLA DE PEDIDOS

    document.addEventListener('change', async (e) => {
        if (e.target.classList.contains('select-estado-pedido')) {
            const pedidoId = e.target.dataset.id;
            const nuevoEstado = e.target.value;
            const selectOriginal = e.target;

            selectOriginal.disabled = true;

            try {
                const respuesta = await fetchAuth(`${API_URL}/pedidos/${pedidoId}/estado`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ estado: nuevoEstado })
                });

                if (!respuesta.ok) {
                    const err = await respuesta.json();
                    throw new Error(err.error || 'Error al actualizar estado');
                }

                // Cambiar color del borde
                selectOriginal.classList.remove('border-warning', 'border-info', 'border-success', 'border-danger');
                if (nuevoEstado === 'pendiente') selectOriginal.classList.add('border-warning');
                else if (nuevoEstado === 'despachado') selectOriginal.classList.add('border-info');
                else if (nuevoEstado === 'entregado' || nuevoEstado === 'completado') selectOriginal.classList.add('border-success');
                else if (nuevoEstado === 'cancelado') selectOriginal.classList.add('border-danger');

            } catch (error) {
                console.error('Error al cambiar estado:', error);
                if (error.message !== 'Sesión expirada') {
                    alert(` Error: ${error.message}`);
                    await cargarPedidos();
                }
            } finally {
                if (selectOriginal) selectOriginal.disabled = false;
            }
        }
    });

    // GUARDAR EDICIÓN DE PRODUCTO 

    const btnGuardarEdicion = document.getElementById('btnGuardarEdicion');
    if (btnGuardarEdicion) {
        btnGuardarEdicion.addEventListener('click', async () => {
            const id = document.getElementById('edit-id').value;
            const nombre = document.getElementById('edit-nombre').value.trim();
            const stock = parseInt(document.getElementById('edit-stock').value, 10);
            const categoria = document.getElementById('edit-categoria').value;
            const ubicacion = document.getElementById('edit-ubicacion').value.trim();

            if (!nombre || isNaN(stock) || stock < 0 || !categoria || !ubicacion) {
                alert(' Por favor, completa todos los campos correctamente.');
                return;
            }

            try {
                const respuesta = await fetchAuth(`${API_URL}/products/${id}`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ nombre, stock, categoria, ubicacion })
                });

                const data = await respuesta.json();
                if (!respuesta.ok) throw new Error(data.error || 'Error al actualizar');

                modalEditar.hide();
                await recargarTarjetas();
                alert(` Producto [${data.producto.sku}] actualizado correctamente.`);
            } catch (error) {
                console.error('Error al actualizar:', error);
                if (error.message !== 'Sesión expirada') {
                    alert(` Error: ${error.message}`);
                }
            }
        });
    }

    // CREAR NUEVO PRODUCTO (POST desde el Modal)
  
    const btnGuardarNuevoProducto = document.getElementById('btnGuardarNuevoProducto');
    const formNuevoProducto = document.getElementById('formNuevoProducto');

    if (btnGuardarNuevoProducto && formNuevoProducto) {
        btnGuardarNuevoProducto.addEventListener('click', async () => {
            if (!formNuevoProducto.checkValidity()) {
                formNuevoProducto.classList.add('was-validated');
                return;
            }

            const nuevoProducto = {
                sku: document.getElementById('nuevo-sku').value.toUpperCase(),
                nombre: document.getElementById('nuevo-nombre').value.trim(),
                stock: parseInt(document.getElementById('nuevo-stock').value, 10),
                categoria: document.getElementById('nuevo-categoria').value,
                ubicacion: document.getElementById('nuevo-ubicacion').value.trim()
            };

            btnGuardarNuevoProducto.disabled = true;
            btnGuardarNuevoProducto.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

            try {
                const respuesta = await fetchAuth(`${API_URL}/products`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify(nuevoProducto)
                });

                const data = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(data.error || 'Error al registrar producto');
                }

                modalNuevo.hide();
                formNuevoProducto.reset();
                formNuevoProducto.classList.remove('was-validated');

                await recargarTarjetas();
                alert(` Producto [${data.producto.sku}] registrado exitosamente.`);

            } catch (error) {
                console.error('Error al crear producto:', error);
                if (error.message !== 'Sesión expirada') {
                    alert(` Error: ${error.message}`);
                }
            } finally {
                btnGuardarNuevoProducto.disabled = false;
                btnGuardarNuevoProducto.innerHTML = '<i class="bi bi-save-fill me-1"></i> Guardar Producto';
            }
        });
    }
  
    // CARGAR PRODUCTOS 

    async function cargarInsumosAPI() {
        try {
            const respuesta = await fetchAuth(`${API_URL}/products`, {
                headers: authHeaders()
            });

            if (!respuesta.ok) throw new Error('Error al consultar la API');

            const productos = await respuesta.json();

            const contenedor = document.getElementById('contenedorTarjetas');
            if (contenedor) contenedor.innerHTML = '';
            resetearMetricas();

            productos.forEach((item) => {
                renderizarTarjetaDOM({
                    id: item.id,
                    sku: item.sku || 'SKU-GENERAL',
                    categoria: item.categoria || 'Cartón Corrugado',
                    nombre: item.nombre,
                    descripcion: `Ubicación: ${item.ubicacion || 'Sin asignar'}`,
                    cantidad: item.stockActual,
                    unidad: 'pzas',
                    ubicacion: item.ubicacion || 'Sin asignar'
                });
            });

            console.log(` ${productos.length} productos cargados`);
        } catch (error) {
            console.error(' Error al cargar productos:', error);
        }
    }

    async function recargarTarjetas() {
        const contenedor = document.getElementById('contenedorTarjetas');
        if (contenedor) contenedor.innerHTML = '';
        resetearMetricas();
        await cargarInsumosAPI();
    }

    // CARGAR PEDIDOS (GET protegido)
  
    async function cargarPedidos() {
        try {
            const respuesta = await fetchAuth(`${API_URL}/pedidos`, {
                headers: authHeaders()
            });
            if (!respuesta.ok) return;
            const pedidos = await respuesta.json();
            const tbody = document.getElementById('tbodyPedidos');
            if (!tbody) return;

            if (pedidos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay pedidos registrados.</td></tr>';
                return;
            }

            tbody.innerHTML = pedidos.map(p => {
                let cliente = 'Cliente anónimo';
                if (p.nombreCliente) cliente = p.nombreCliente;
                else if (p.usuario) cliente = p.usuario.nombre;

                const origenBadge = p.origen === 'publico' 
                    ? '<span class="badge bg-info text-dark">Público</span>' 
                    : '<span class="badge bg-secondary">Interno</span>';

                const estados = ['pendiente', 'despachado', 'entregado', 'completado', 'cancelado'];
                const opcionesEstado = estados.map(est => 
                    `<option value="${est}" ${p.estado === est ? 'selected' : ''}>${est.charAt(0).toUpperCase() + est.slice(1)}</option>`
                ).join('');

                let borderClass = 'border-warning';
                if (p.estado === 'despachado') borderClass = 'border-info';
                if (p.estado === 'entregado' || p.estado === 'completado') borderClass = 'border-success';
                if (p.estado === 'cancelado') borderClass = 'border-danger';

                return `
                    <tr>
                        <td>${p.id}</td>
                        <td>${cliente}</td>
                        <td>${p.producto?.nombre || 'Producto #' + p.productoId}</td>
                        <td>${p.cantidad}</td>
                        <td>$${parseFloat(p.total).toFixed(2)}</td>
                        <td>${origenBadge}</td>
                        <td>
                            <select class="form-select form-select-sm select-estado-pedido ${borderClass}" data-id="${p.id}" style="min-width: 120px;">
                                ${opcionesEstado}
                            </select>
                        </td>
                        <td>${new Date(p.fechaPedido).toLocaleString()}</td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Error al cargar pedidos:', error);
        }
    }

    // RENDERIZADO DE TARJETAS
   
    function renderizarTarjetaDOM(insumo) {
        let estado = 'Óptimo';
        let badgeClass = 'bg-success';
        if (insumo.cantidad < 50) { estado = 'Crítico'; badgeClass = 'bg-danger'; }
        else if (insumo.cantidad <= 300) { estado = 'Reorden'; badgeClass = 'bg-warning text-dark'; }

        const contenedor = document.getElementById('contenedorTarjetas');
        if (contenedor) {
            const html = `
                <article class="h-100">
                    <div class="card h-100 border-0 shadow-sm card-hover">
                        <div class="card-body d-flex flex-column">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <span class="badge bg-warning text-dark font-monospace">${insumo.categoria}</span>
                                <div class="d-flex gap-1">
                                    <button class="btn btn-sm btn-outline-primary btn-editar border-0"
                                            data-id="${insumo.id}" data-sku="${insumo.sku}"
                                            data-nombre="${insumo.nombre}" data-stock="${insumo.cantidad}"
                                            data-categoria="${insumo.categoria}" data-ubicacion="${insumo.ubicacion}"
                                            title="Editar producto">
                                        <i class="bi bi-pencil fs-5"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger btn-eliminar border-0"
                                            data-id="${insumo.id}" data-stock="${insumo.cantidad}"
                                            title="Eliminar insumo">
                                        <i class="bi bi-trash fs-5"></i>
                                    </button>
                                </div>
                            </div>
                            <h5 class="card-title fw-bold">${insumo.nombre}</h5>
                            <p class="card-text text-muted flex-grow-1">${insumo.descripcion}</p>
                            <button class="btn btn-sm btn-outline-dark mb-3 w-100 btn-detalle"
                                    data-sku="${insumo.sku}" data-nombre="${insumo.nombre}"
                                    data-categoria="${insumo.categoria}" data-stock="${insumo.cantidad}"
                                    data-unidad="${insumo.unidad}" data-estado="${estado}"
                                    data-ubicacion="${insumo.ubicacion}">
                                <i class="bi bi-info-circle me-1"></i>Ver Detalle
                            </button>
                            <div class="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                                <small class="text-secondary">SKU: <strong>${insumo.sku}</strong></small>
                                <span class="badge ${badgeClass}">${estado} (${insumo.cantidad.toLocaleString()} ${insumo.unidad})</span>
                            </div>
                        </div>
                    </div>
                </article>
            `;
            contenedor.insertAdjacentHTML('beforeend', html);
        }

        sumarMetricas(insumo.cantidad, estado);
    }

    // MÉTRICAS
   
    function resetearMetricas() {
        const s = document.getElementById('metric-skus');
        const u = document.getElementById('metric-unidades');
        const a = document.getElementById('metric-alertas');
        if (s) s.textContent = '0';
        if (u) u.textContent = '0';
        if (a) a.textContent = '0';
    }

    function sumarMetricas(cantidad, estado) {
        const s = document.getElementById('metric-skus');
        const u = document.getElementById('metric-unidades');
        const a = document.getElementById('metric-alertas');
        if (!s || !u || !a) return;

        let skus = parseInt(s.textContent.replace(/,/g, ''), 10) || 0;
        let unidades = parseInt(u.textContent.replace(/,/g, ''), 10) || 0;
        let alertas = parseInt(a.textContent.replace(/,/g, ''), 10) || 0;

        skus += 1;
        unidades += cantidad;
        if (estado === 'Crítico' || estado === 'Reorden') alertas += 1;

        s.textContent = skus.toLocaleString();
        u.textContent = unidades.toLocaleString();
        a.textContent = alertas.toLocaleString();
    }

    function descontarMetricas(cantidadRestada) {
        const s = document.getElementById('metric-skus');
        const u = document.getElementById('metric-unidades');
        if (!s || !u) return;

        let skus = parseInt(s.textContent.replace(/,/g, ''), 10) || 0;
        let unidades = parseInt(u.textContent.replace(/,/g, ''), 10) || 0;

        skus = Math.max(0, skus - 1);
        unidades = Math.max(0, unidades - cantidadRestada);

        s.textContent = skus.toLocaleString();
        u.textContent = unidades.toLocaleString();
    }

    // INICIALIZACIÓN
  
    if (isAuthenticated()) {
        mostrarApp();
    } else {
        mostrarLogin();
    }

})();
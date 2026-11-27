(function() {
    'use strict';

    const API_URL = 'http://localhost:3000/api';

    // CARGAR PRODUCTOS EN EL CATÁLOGO Y EN EL SELECT
    async function cargarProductos() {
        const contenedor = document.getElementById('contenedorTarjetasPublico');
        const select = document.getElementById('cliProducto');

        try {
            const respuesta = await fetch(`${API_URL}/products/publicos`);
            if (!respuesta.ok) throw new Error('Error al cargar productos');

            const productos = await respuesta.json();

            // Limpiar contenedores
            if (contenedor) contenedor.innerHTML = '';
            if (select) select.innerHTML = '<option value="" selected disabled>Selecciona un material...</option>';

            if (productos.length === 0) {
                if (contenedor) {
                    contenedor.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bi bi-inbox fs-1"></i><p class="mt-2">No hay productos disponibles por el momento.</p></div>';
                }
                return;
            }

            // Renderizar tarjetas y opciones del select
            productos.forEach(p => {
                renderizarTarjetaPublica(p, contenedor);

                if (select) {
                    const option = document.createElement('option');
                    option.value = p.id;
                    option.textContent = `${p.nombre} (Disponibles: ${p.stockActual} pzas)`;
                    if (p.stockActual === 0) {
                        option.disabled = true;
                        option.textContent += ' — Agotado';
                    }
                    select.appendChild(option);
                }
            });

        } catch (error) {
            console.error('Error al cargar productos:', error);
            if (contenedor) {
                contenedor.innerHTML = '<div class="col-12 text-center text-danger py-5"><i class="bi bi-exclamation-triangle fs-1"></i><p class="mt-2">Error al cargar productos. Verifica que el servidor esté encendido.</p></div>';
            }
            if (select) {
                select.innerHTML = '<option value="" disabled>Error al cargar productos</option>';
            }
        }
    }

    // RENDERIZAR TARJETA PÚBLICA (solo lectura)
   
    function renderizarTarjetaPublica(producto, contenedor) {
        if (!contenedor) return;

        let estado = 'Disponible';
        let badgeClass = 'bg-success';
        if (producto.stockActual === 0) { estado = 'Agotado'; badgeClass = 'bg-danger'; }
        else if (producto.stockActual < 50) { estado = 'Bajo stock'; badgeClass = 'bg-warning text-dark'; }

        const html = `
            <article class="h-100">
                <div class="card h-100 border-0 shadow-sm card-hover">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex align-items-center justify-content-between mb-3">
                            <span class="badge bg-warning text-dark font-monospace">${producto.categoria || 'General'}</span>
                            <span class="badge ${badgeClass}">${estado}</span>
                        </div>
                        <h5 class="card-title fw-bold">${producto.nombre}</h5>
                        <p class="card-text text-muted flex-grow-1">
                            <i class="bi bi-geo-alt me-1"></i>${producto.ubicacion || 'Sin ubicación'}
                        </p>
                        <div class="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                            <small class="text-secondary">SKU: <strong>${producto.sku}</strong></small>
                            <span class="text-success fw-bold">
                                <i class="bi bi-box-seam me-1"></i>${producto.stockActual.toLocaleString()} pzas
                            </span>
                        </div>
                    </div>
                </div>
            </article>
        `;
        contenedor.insertAdjacentHTML('beforeend', html);
    }

    // ENVIAR PEDIDO

    const form = document.getElementById('formPedidoPublico');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const mensajeDiv = document.getElementById('pedidoPublicoMensaje');
            const btnEnviar = document.getElementById('btnEnviarPedido');

            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }

            const nombreCliente = document.getElementById('cliNombre').value.trim();
            const direccionCliente = document.getElementById('cliDireccion').value.trim();
            const productoId = parseInt(document.getElementById('cliProducto').value, 10);
            const cantidad = parseInt(document.getElementById('cliCantidad').value, 10);

            btnEnviar.disabled = true;
            btnEnviar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

            try {
                const respuesta = await fetch(`${API_URL}/pedidos/publicos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombreCliente, direccionCliente, productoId, cantidad })
                });

                const data = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(data.error || 'Error al enviar el pedido');
                }

                mensajeDiv.className = 'alert alert-success';
                mensajeDiv.innerHTML = `
                    <i class="bi bi-check-circle-fill me-2"></i>
                    <strong>¡Pedido recibido!</strong><br>
                    Pedido <strong>#${data.pedido.id}</strong> — ${data.pedido.producto} × ${data.pedido.cantidad}.
                    Total: <strong>$${parseFloat(data.pedido.total).toFixed(2)}</strong>.<br>
                    <small>Nos pondremos en contacto contigo para coordinar la entrega.</small>
                `;
                mensajeDiv.classList.remove('d-none');

                form.reset();
                form.classList.remove('was-validated');
                await cargarProductos();

            } catch (error) {
                mensajeDiv.className = 'alert alert-danger';
                mensajeDiv.innerHTML = `<i class="bi bi-x-circle-fill me-2"></i><strong>Error:</strong> ${error.message}`;
                mensajeDiv.classList.remove('d-none');
            } finally {
                btnEnviar.disabled = false;
                btnEnviar.innerHTML = '<i class="bi bi-send-fill me-1"></i> Enviar Pedido';
            }
        });
    }

    // INICIALIZACIÓN
    cargarProductos();

})();
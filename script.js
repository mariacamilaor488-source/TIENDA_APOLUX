// Productos que se cargarán desde SQLite
let PRODUCTS = {};
let selectedCategory = null;

// Carrito de compras
let cart = loadCart();
let toastTimer;

// Acceso rápido a elementos HTML
const $ = selector => document.querySelector(selector);

const cartDrawer = $('#cartDrawer');
const overlay = $('#overlay');
const cartItems = $('#cartItems');

// Formatear precios en pesos colombianos
const money = value => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
}).format(value);

// Evitar insertar texto de productos como HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

// Recuperar el carrito guardado
function loadCart() {
    try {
        const saved = JSON.parse(
            localStorage.getItem('apolux-cart') || '[]'
        );

        return Array.isArray(saved)
            ? saved.filter(item =>
                typeof item.id === 'string' &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0
            )
            : [];
    } catch {
        return [];
    }
}

// Guardar el carrito
function saveCart() {
    localStorage.setItem(
        'apolux-cart',
        JSON.stringify(cart)
    );
}

// Consultar productos en el servidor
async function loadProducts() {
    const grid = $('#productGrid');

    try {
        grid.innerHTML = '<p>Cargando productos...</p>';

        const response = await fetch('http://localhost:3000/api/productos');

        if (!response.ok) {
            throw new Error('No se pudieron consultar los productos');
        }

        const products = await response.json();

        PRODUCTS = {};

        products.forEach(product => {
            PRODUCTS[product.slug] = product;
        });

        renderProducts();
        renderCart();

    } catch (error) {
        console.error(error);

        grid.innerHTML = `
            <p>No fue posible cargar los productos.
            Comprueba que el servidor esté funcionando.</p>
        `;
    }
}


// Mostrar los productos recibidos de SQLite
function renderProducts(category = selectedCategory) {
    const grid = $('#productGrid');

    selectedCategory = category;

    const products = Object.values(PRODUCTS);

    // Filtrar productos según la categoría seleccionada
    const filteredProducts = category
        ? products.filter(product =>
            category.split('|').includes(product.categoria)
        )
        : products;

    if (filteredProducts.length === 0) {
        grid.innerHTML = '<p>No hay productos disponibles en esta categoría.</p>';
        return;
    }

    grid.innerHTML = filteredProducts.map(product => `
        <article class="product-card" data-id="${escapeHTML(product.slug)}">
            <div class="product-image">
                <img
                    src="${escapeHTML(product.imagen)}"
                    alt="${escapeHTML(product.nombre)}"
                    loading="lazy"
                >
            </div>

            <div class="product-info">
                <p class="product-type">
                    ${escapeHTML(product.categoria || 'APOLUX')}
                </p>

                <h3>${escapeHTML(product.nombre)}</h3>

                <p class="description">
                    ${escapeHTML(product.descripcion || '')}
                </p>

                <div class="product-bottom">
                    <strong>
                        ${money(product.precio)}
                        <small>COP</small>
                    </strong>

                    <button
                        class="add-btn"
                        data-add="${escapeHTML(product.slug)}"
                        ${product.stock <= 0 ? 'disabled' : ''}
                    >
                        ${product.stock > 0
                            ? 'Agregar al carrito'
                            : 'Agotado'}
                        <span>＋</span>
                    </button>
                </div>
            </div>
        </article>
    `).join('');
}


// Cantidad total de productos en el carrito
function cartQuantity() {
    return cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );
}

// Calcular el total del carrito
function cartTotal() {
    return cart.reduce((sum, item) => {
        const product = PRODUCTS[item.id];

        return sum + (
            product ? product.precio * item.quantity : 0
        );
    }, 0);
}

// Mostrar notificaciones
function showToast(title, message) {
    $('#toastTitle').textContent = title;
    $('#toastMessage').textContent = message;
    $('#toast').classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        $('#toast').classList.remove('show');
    }, 3500);
}

// Agregar un producto al carrito
function addToCart(id) {
    const product = PRODUCTS[id];

    if (!product) return;

    const existing = cart.find(item => item.id === id);
    const quantity = existing ? existing.quantity : 0;

    if (quantity >= product.stock) {
        showToast(
            'Stock insuficiente',
            'No hay más unidades disponibles de este producto.'
        );
        return;
    }

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id,
            quantity: 1
        });
    }

    saveCart();
    renderCart();

    showToast(
        '¡Producto agregado!',
        `${product.nombre} se agregó correctamente a tu carrito.`
    );
}

// Cambiar la cantidad de un producto
function changeQuantity(id, amount) {
    const item = cart.find(product => product.id === id);
    const product = PRODUCTS[id];

    if (!item || !product) return;

    const newQuantity = item.quantity + amount;

    if (newQuantity > product.stock) {
        showToast(
            'Stock insuficiente',
            'No hay más unidades disponibles.'
        );
        return;
    }

    item.quantity = newQuantity;

    if (item.quantity <= 0) {
        cart = cart.filter(product => product.id !== id);
    }

    saveCart();
    renderCart();
}

// Eliminar un producto del carrito
function removeFromCart(id) {
    const product = PRODUCTS[id];

    cart = cart.filter(item => item.id !== id);

    saveCart();
    renderCart();

    if (product) {
        showToast(
            'Producto eliminado',
            `${product.nombre} se eliminó de tu carrito.`
        );
    }
}

// Dibujar el carrito
function renderCart() {
    const count = cartQuantity();

    $('#cartCount').textContent = count;
    $('#drawerCount').textContent = `(${count})`;

    // Eliminar del carrito productos que ya no existan
    cart = cart.filter(item => PRODUCTS[item.id]);

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <span>♧</span>
                <h3>Tu carrito está vacío</h3>
                <p>Descubre nuestros productos y agrega tus favoritos.</p>
                <button class="btn btn-gold" id="continueShopping">
                    Explorar productos
                </button>
            </div>
        `;

        $('#cartSummary').hidden = true;

        $('#continueShopping').addEventListener(
            'click',
            closeCart
        );

        $('#cartCount').textContent = 0;
        $('#drawerCount').textContent = '(0)';

        return;
    }

    cartItems.innerHTML = cart.map(item => {
        const product = PRODUCTS[item.id];

        return `
            <article class="cart-item">
                <img
                    src="${escapeHTML(product.imagen)}"
                    alt="${escapeHTML(product.nombre)}"
                >

                <div>
                    <h3>${escapeHTML(product.nombre)}</h3>

                    <p class="item-price">
                        ${money(product.precio)}
                    </p>

                    <div class="quantity">
                        <button
                            data-quantity="${escapeHTML(item.id)}"
                            data-change="-1"
                            aria-label="Disminuir cantidad"
                        >−</button>

                        <span>${item.quantity}</span>

                        <button
                            data-quantity="${escapeHTML(item.id)}"
                            data-change="1"
                            aria-label="Aumentar cantidad"
                        >+</button>
                    </div>
                </div>

                <button
                    class="remove-item"
                    data-remove="${escapeHTML(item.id)}"
                    aria-label="Eliminar ${escapeHTML(product.nombre)}"
                >⌫</button>
            </article>
        `;
    }).join('');

    $('#cartSummary').hidden = false;

    $('#cartSubtotal').textContent = money(cartTotal());
    $('#cartTotal').textContent = money(cartTotal());
    $('#checkoutTotal').textContent = money(cartTotal());

    $('#cartCount').textContent = count;
    $('#drawerCount').textContent = `(${count})`;
}

// Abrir carrito
function openCart() {
    cartDrawer.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');

    overlay.classList.add('visible');

    document.body.classList.add('locked');

    $('#closeCart').focus();
}

// Cerrar carrito
function closeCart() {
    cartDrawer.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');

    overlay.classList.remove('visible');

    document.body.classList.remove('locked');
}

// Abrir formulario de compra
function openCheckout() {
    if (!cart.length) return;

    closeCart();

    $('#checkoutTotal').textContent = money(cartTotal());

    $('#checkoutModal').classList.add('open');
    $('#modalBackdrop').classList.add('visible');

    $('#checkoutModal').setAttribute('aria-hidden', 'false');

    document.body.classList.add('locked');

    $('#customerName').focus();
}

// Cerrar formulario de compra
function closeCheckout() {
    $('#checkoutModal').classList.remove('open');
    $('#modalBackdrop').classList.remove('visible');

    $('#checkoutModal').setAttribute('aria-hidden', 'true');

    document.body.classList.remove('locked');
}

// Detectar clics en los botones de productos y carrito
document.addEventListener('click', event => {
    const addButton = event.target.closest('[data-add]');
    const quantityButton = event.target.closest('[data-quantity]');
    const removeButton = event.target.closest('[data-remove]');

    if (addButton) {
        addToCart(addButton.dataset.add);
    }

    if (quantityButton) {
        changeQuantity(
            quantityButton.dataset.quantity,
            Number(quantityButton.dataset.change)
        );
    }

    if (removeButton) {
        removeFromCart(removeButton.dataset.remove);
    }
});

// Eventos del carrito y las ventanas
$('#openCart').addEventListener('click', openCart);
$('#closeCart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);

$('#checkoutBtn').addEventListener('click', openCheckout);
$('#closeCheckout').addEventListener('click', closeCheckout);

$('#modalBackdrop').addEventListener('click', closeCheckout);

$('#closeToast').addEventListener('click', () => {
    $('#toast').classList.remove('show');
});

// Registrar pedido en SQLite
$('#checkoutForm').addEventListener('submit', async event => {
    event.preventDefault();
    const formulario = event.currentTarget;

    if (!cart.length) return;

    const formData = new FormData(event.currentTarget);

    const pedido = {
        nombre: formData.get('customerName').trim(),
        correo: formData.get('customerEmail').trim(),
        telefono: formData.get('customerPhone').trim(),
        direccion: formData.get('customerAddress').trim(),

        productos: cart.map(item => ({
            slug: item.id,
            cantidad: item.quantity
        }))
    };

    const submitButton = event.currentTarget.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = 'Registrando pedido...';

    try {
        const response = await fetch('/api/pedidos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pedido)
        });

        const resultado = await response.json();

        if (!response.ok) {
            throw new Error(
                resultado.error || 'No se pudo registrar el pedido'
            );
        }

        const resumen = `
PEDIDO DE DEMOSTRACIÓN APOLUX

Número de pedido: ${resultado.pedido.id_pedido}
Cliente: ${pedido.nombre}

Total: ${money(resultado.pedido.total)}

Esta es una simulación académica.
No se ha realizado ningún pago.
        `;

        closeCheckout();

        cart = [];

        saveCart();
        renderCart();

        formulario.reset();

        showToast(
            '¡Pedido registrado!',
            'El pedido quedó guardado en la base de datos.'
        );

        alert(resumen);

        // Actualizar productos y existencias
        await loadProducts();

    } catch (error) {
        console.error(error);

        showToast(
            'No se pudo registrar',
            error.message
        );

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Generar pedido de demostración';
    }
});

// Menú para dispositivos móviles
$('#mobileMenu').addEventListener('click', () => {
    const isOpen = $('#mainNav').classList.toggle('show');

    $('#mobileMenu').setAttribute(
        'aria-expanded',
        String(isOpen)
    );
});

$('#mainNav').addEventListener('click', event => {
    if (event.target.closest('a')) {
        $('#mainNav').classList.remove('show');

        $('#mobileMenu').setAttribute(
            'aria-expanded',
            'false'
        );
    }
});

// Cerrar ventanas con Escape
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeCart();
        closeCheckout();

        $('#toast').classList.remove('show');
    }
});


// Desplazamiento de las categorías
const categoriesTrack = $('#categoriesTrack');
const categoryPrev = $('#categoryPrev');
const categoryNext = $('#categoryNext');

categoryPrev.addEventListener('click', () => {
    categoriesTrack.scrollBy({
        left: -categoriesTrack.clientWidth,
        behavior: 'smooth'
    });
});

categoryNext.addEventListener('click', () => {
    categoriesTrack.scrollBy({
        left: categoriesTrack.clientWidth,
        behavior: 'smooth'
    });
});

// Seleccionar categoría
document.querySelectorAll('.category[data-category]').forEach(category => {
    category.addEventListener('click', event => {
        event.preventDefault();

        renderProducts(category.dataset.category);

        $('#productos').scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Mostrar todos los productos al seleccionar Productos en el menú
document.querySelectorAll('a[href="#productos"]:not(.category)')
    .forEach(link => {
        link.addEventListener('click', () => {
            selectedCategory = null;
            renderProducts(null);
        });
    });

// Cargar los productos al iniciar la página
loadProducts();


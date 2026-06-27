// ==========================================
// DatabaseService Module (Promise-based for Router)
// ==========================================
defineModule("DatabaseService", [], function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var dbName = "QuotationsPWA";
    var dbVersion = 2; // Incremented version to add new stores
    var dbInstance = null;

    function init() {
        return new Promise((resolve, reject) => {
            var request = indexedDB.open(dbName, dbVersion);
            request.onupgradeneeded = function(event) {
                var db = event.target.result;
                var stores = ['clients', 'providers', 'products', 'product_categories', 'services', 'service_categories', 'inventory', 'business_info', 'quotations'];
                stores.forEach(store => {
                    if (!db.objectStoreNames.contains(store)) {
                        db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
                    }
                });
            };
            request.onsuccess = function(event) {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };
            request.onerror = function(event) {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Generic CRUD Methods wrapped in Promises for clean async/await
    function getAll(storeName) {
        return new Promise((resolve) => {
            if (!dbInstance) return resolve([]);
            var tx = dbInstance.transaction([storeName], 'readonly');
            var store = tx.objectStore(storeName);
            var request = store.getAll();
            request.onsuccess = () => resolve(request.result);
        });
    }

    function save(storeName, data) {
        return new Promise((resolve) => {
            var tx = dbInstance.transaction([storeName], 'readwrite');
            var store = tx.objectStore(storeName);
            // If data has an ID, it updates (put). If not, it creates (add).
            var request = data.id ? store.put(data) : store.add(data);
            request.onsuccess = (e) => resolve(e.target.result);
        });
    }

    function remove(storeName, id) {
        return new Promise((resolve) => {
            var tx = dbInstance.transaction([storeName], 'readwrite');
            var store = tx.objectStore(storeName);
            var request = store.delete(Number(id));
            request.onsuccess = () => resolve(true);
        });
    }

    exports.init = init;
    exports.getAll = getAll;
    exports.save = save;
    exports.remove = remove;
}, null);

// ==========================================
// Database Seeder Module (Updated with Descriptions)
// ==========================================
defineModule("DataSeeder", ["DatabaseService"], function(global, requireModule, requireDynamic, requireLazy, module, exports, DB) {
    'use strict';

    var defaultLogoBase64 = "data:image/png;base64,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";

    var seedData = {
        business: {
            id: 1,
            name: "Luis Antonio Mendoza Hernández",
            rfc: "MEHL961218KL6",
            address: "Calle Altamirano. #100, Col. Centro, Petatlán, Guerrero",
            phone: "758 108 5011",
            email: "la.mendoza.1618@gmail.com",
            logo: defaultLogoBase64
        },
        products: [
            // --- Software & Licenses ---
            { title: "Licencia Sistema POS (Paquete Base)", price: 14000, category: "Software", description: "Sistema de Punto de Venta (Inventario, Proveedores, 5 perfiles). Modo offline con sincronización en la nube y respaldos diarios. Incluye instalación (3 PCs), lector de barras e impresora. 6 meses de soporte." },
            { title: "Módulo POS Móvil (Add-on)", price: 3500, category: "Software", description: "Aplicación móvil complementaria para gestión de inventario y ventas en piso, sincronizada en tiempo real." },
            { title: "Software de Gestión Hotelera (Suite)", price: 35000, category: "Software", description: "Panel administrativo completo (habitaciones, tarifas, reservas), landing page y notificaciones en tiempo real." },
            { title: "Suscripción Menú Digital QR (Anual)", price: 1800, category: "Software", description: "Plataforma de menú autoadministrable con código QR." },
            
            // --- Hosting Services (Hostinger Based + Management Markup) ---
            { title: "Hosting Premium + Dominio (1 Año)", price: 1500, category: "Infraestructura", description: "100GB SSD, ancho de banda ilimitado, SSL gratuito, cuentas de correo y dominio .com/.mx. Ideal para Landing Pages." },
            { title: "Hosting Empresarial NVMe (1 Año)", price: 2500, category: "Infraestructura", description: "200GB NVMe, rendimiento x5, respaldos diarios automáticos y CDN. Excelente para aplicaciones web y tiendas." },
            { title: "Cloud Hosting Dedicado (1 Año)", price: 4800, category: "Infraestructura", description: "Recursos dedicados (IP dedicada, 3GB RAM, 2 Cores). Optimizado para aplicaciones Laravel/MySQL de alto tráfico." },
            { title: "Póliza de Soporte y Nube (Anual)", price: 2500, category: "Mantenimiento", description: "Renovación de servidor, respaldos automáticos y soporte técnico extendido para sistemas previamente instalados." }
        ],
        services: [
            // --- Web Development ---
            { title: "Desarrollo Landing Page (Básico)", price: 3500, category: "Desarrollo Web", description: "Diseño responsivo de una sección, formulario de contacto y botón flotante de WhatsApp. Alta velocidad de carga." },
            { title: "Desarrollo Landing Page (Starter)", price: 6000, category: "Desarrollo Web", description: "Diseño a medida de hasta 3 secciones (Inicio, Servicios, Contacto). SEO on-page y métricas de Google Analytics." },
            { title: "Desarrollo Landing Page (Corporativo)", price: 10000, category: "Desarrollo Web", description: "Diseño de interfaz exclusivo, animaciones, integración con APIs externas (CRM/Mailchimp) y optimización de conversión." },
            { title: "Desarrollo de Aplicación Web a Medida", price: 35000, category: "Desarrollo Web", description: "Desarrollo de software personalizado con panel administrativo, roles de usuario, y base de datos relacional." },
            
            // --- Marketing & Ads ---
            { title: "Gestión de Facebook Ads (Semanal)", price: 2500, category: "Marketing", description: "Mantenimiento mensual. Incluye diseño de 3 posts y 2 reels a la semana. (Pauta no incluida)." },
            { title: "Gestión de Facebook Ads (Quincenal)", price: 4500, category: "Marketing", description: "Estrategia de crecimiento mensual. 6 posts y 4 reels por quincena. Coordinación visual y reporte de rendimiento. (Pauta no incluida)." },
            { title: "Gestión de Facebook Ads (Mensual)", price: 8000, category: "Marketing", description: "Campaña agresiva mensual. 9 posts y 6 reels al mes. Dirección creativa, pruebas A/B de anuncios. (Pauta no incluida)." }
        ]
    };


    async function runSeed() {
        var businessInfo = await DB.getAll('business_info');
        if (businessInfo.length > 0) return; // Already seeded

        console.log("Seeding Database...");
        await DB.save('business_info', seedData.business);
        for (var i = 0; i < seedData.products.length; i++) await DB.save('products', seedData.products[i]);
        for (var j = 0; j < seedData.services.length; j++) await DB.save('services', seedData.services[j]);
        console.log("Seeding complete!");
    }

    exports.runSeed = runSeed;
}, null);

// ==========================================
// Router Module
// ==========================================
defineModule("Router", ["DatabaseService", "$"], function(global, requireModule, requireDynamic, requireLazy, module, exports, DatabaseService, $) {
    'use strict';

    var routes = {
        '#quotations': 'QuotationView',
        '#clients': 'ClientsView',
        '#providers': 'ProvidersView',
        '#products': 'ProductsView',
        '#products/categories': 'ProductCategoriesView',
        '#products/inventory': 'InventoryView',
        '#services': 'ServicesView',
        '#services/categories': 'ServiceCategoriesView',
        '#business': 'BusinessView',
        '#config': 'ConfigView'
    };

    var viewTitles = {
        '#quotations': 'Quotations',
        '#clients': 'Clients Management',
        '#business': 'Business Profile'
    };

    async function handleRoute() {
        const hash = window.location.hash || '#quotations';

        // 1. Business Guard
        const business = await DatabaseService.getAll('business_info');
        if (business.length === 0 && hash !== '#business') {
            window.location.hash = '#business';
            return;
        }

        // 2. Resolve Module
        var moduleName = routes[hash] || 'QuotationView';

        // 3. Update UI state
        updateSidebarActiveState(hash);
        
        var titleEl = $.fromIDOrElement("view_title");
        if (titleEl) titleEl.innerText = viewTitles[hash] || "Dashboard";

        // 4. Render
        renderView(moduleName);
    }

    function updateSidebarActiveState(hash) {
        var links = document.querySelectorAll('#sidebar a');
        for (var i = 0; i < links.length; i++) links[i].classList.remove('active');
        
        var activeLink = document.querySelector('#sidebar a[href="' + hash + '"]');
        if (activeLink) activeLink.classList.add('active');

        requireModule("LayoutUI").closeSidebar();
    }

    function renderView(moduleName) {
        const container = $.fromIDOrElement('main-content');
        requireDynamic(moduleName, function(View) {
            if (View && View.render) {
                View.render(container);
            }
        });
    }

    exports.init = function() {
        window.addEventListener('hashchange', handleRoute);
        handleRoute();
    };
}, null);

// ==========================================
// Layout UI Controller
// ==========================================
defineModule("LayoutUI", ["$", "CSSCore"], function(global, requireModule, requireDynamic, requireLazy, module, exports, $, CSSCore) {
    'use strict';
    function toggleSidebar(event) {
        var sidebar = $.fromIDOrElement("sidebar");
        CSSCore.toggleClass(sidebar, "open");
    }

    function closeSidebar(event) {
        var sidebar = $.fromIDOrElement("sidebar");
        CSSCore.removeClass(sidebar, "open");
    }
    exports.toggleSidebar = toggleSidebar;
    exports.closeSidebar = closeSidebar;
}, null);

// ==========================================
// FormatHelper
// ==========================================
defineModule("FormatHelper", [], function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    /**
     * Formats number to $1,234.56
     */
    function formatCurrency(amount) {
        if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('es-MX', { 
            style: 'currency', 
            currency: 'MXN' 
        }).format(amount);
    }

    /**
     * Converts a number to Mexican Pesos in words (e.g., 104.40 -> Ciento cuatro pesos 40/100 M.N.)
     */
    function numberToWords(num) {
        var data = {
            enteros: Math.floor(num),
            centavos: Math.round((num - Math.floor(num)) * 100),
            letrasMonedaPlural: 'pesos',
            letrasMonedaSingular: 'peso',
            letrasMonedaCentavoPlural: '/100 M.N.'
        };

        var centavosStr = (data.centavos < 10 ? '0' + data.centavos : data.centavos) + data.letrasMonedaCentavoPlural;
        
        if (data.enteros === 0) return "Cero " + data.letrasMonedaPlural + " " + centavosStr;
        
        var currencyName = data.enteros === 1 ? data.letrasMonedaSingular : data.letrasMonedaPlural;
        return Millones(data.enteros) + " " + currencyName + " " + centavosStr;
    }

    // --- Internal Helpers ---
    function Unidades(num) {
        switch (num) {
            case 1: return "un"; case 2: return "dos"; case 3: return "tres"; case 4: return "cuatro";
            case 5: return "cinco"; case 6: return "seis"; case 7: return "siete"; case 8: return "ocho"; case 9: return "nueve";
        }
        return "";
    }

    function Decenas(num) {
        var decena = Math.floor(num / 10);
        var unidad = num - (decena * 10);
        switch (decena) {
            case 1:
                switch (unidad) {
                    case 0: return "diez"; case 1: return "once"; case 2: return "doce"; case 3: return "trece";
                    case 4: return "catorce"; case 5: return "quince"; default: return "dieci" + Unidades(unidad);
                }
            case 2: return unidad === 0 ? "veinte" : "veinti" + Unidades(unidad);
            case 3: return "treinta" + (unidad > 0 ? " y " + Unidades(unidad) : "");
            case 4: return "cuarenta" + (unidad > 0 ? " y " + Unidades(unidad) : "");
            case 5: return "cincuenta" + (unidad > 0 ? " y " + Unidades(unidad) : "");
            case 6: return "sesenta" + (unidad > 0 ? " y " + Unidades(unidad) : "");
            case 7: return "setenta" + (unidad > 0 ? " y " + Unidades(unidad) : "");
            case 8: return "ochenta" + (unidad > 0 ? " y " + Unidades(unidad) : "");
            case 9: return "noventa" + (unidad > 0 ? " y " + Unidades(unidad) : "");
            default: return Unidades(unidad);
        }
    }

    function Centenas(num) {
        var centenas = Math.floor(num / 100);
        var resto = num - (centenas * 100);
        var str = "";
        switch (centenas) {
            case 1: str = (resto > 0) ? "ciento " : "cien"; break;
            case 2: str = "doscientos "; break;
            case 3: str = "trescientos "; break;
            case 4: str = "cuatrocientos "; break;
            case 5: str = "quinientos "; break;
            case 6: str = "seiscientos "; break;
            case 7: str = "setecientos "; break;
            case 8: str = "ochocientos "; break;
            case 9: str = "novecientos "; break;
        }
        return str + Decenas(resto);
    }

    function Miles(num) {
        var divisor = 1000;
        var cientos = Math.floor(num / divisor);
        var resto = num - (cientos * divisor);
        var str = (cientos === 1) ? "mil " : (cientos > 1 ? Centenas(cientos) + " mil " : "");
        return str + Centenas(resto);
    }

    function Millones(num) {
        var divisor = 1000000;
        var cientos = Math.floor(num / divisor);
        var resto = num - (cientos * divisor);
        var str = (cientos === 1) ? "un millón " : (cientos > 1 ? Centenas(cientos) + " millones " : "");
        return str + Miles(resto);
    }

    exports.formatCurrency = formatCurrency;
    exports.numberToWords = numberToWords;
}, null);

// ==========================================
// Stepper Logic Controller (Fully functional Step 1 & 2)
// ==========================================
defineModule("QuotationStepper", ["$", "CSSCore", "DatabaseService", "FormatHelper"], function(global, requireModule, requireDynamic, requireLazy, module, exports, $, CSSCore, DB, FormatHelper) {
    'use strict';

    var currentStep = 1;
    var dialog, btnNext, btnPrev, clientSearchResults, articlesList;
    
    // State variables
    var allClients = [];
    var allArticles = []; // Combined products and services
    var selectedClient = null;
    var selectedArticles = [];

    var defaultClient = { 
        name: "Público en General", 
        rfc: "XAXX010101000", 
        address: "N/A", 
        city: "N/A" 
    };

    function _init() {
        dialog = $.fromIDOrElement("stepper_dialog");
        btnNext = $.fromIDOrElement("stepper_next");
        btnPrev = $.fromIDOrElement("stepper_prev");
        clientSearchResults = $.fromIDOrElement("client_search_results");
        articlesList = $.fromIDOrElement("articles_list");
    }

    function _updateUI() {
        // Toggle Step Contents
        for (var i = 1; i <= 3; i++) {
            var content = $.fromIDOrElement("step_" + i + "_content");
            var indicator = $.fromIDOrElement("indicator_step_" + i);
            if (i === currentStep) {
                CSSCore.addClass(content, "active");
                CSSCore.addClass(indicator, "active");
            } else {
                CSSCore.removeClass(content, "active");
                CSSCore.removeClass(indicator, "active");
            }
        }

        // Toggle Buttons
        btnPrev.style.display = currentStep > 1 ? "block" : "none";
        
        if (currentStep === 1) {
            btnNext.style.display = "block";
            btnNext.innerText = "Next Step";
            btnNext.disabled = false;
        } else if (currentStep === 2) {
            btnNext.style.display = "block";
            btnNext.disabled = selectedArticles.length === 0;
            btnNext.innerText = "Review Quotation";
        } else if (currentStep === 3) {
            btnNext.style.display = "none";
            _renderSummary();
        }
    }

    function _renderSummary() {
        var list = $.fromIDOrElement("quotation_summary_list");
        var totalEl = $.fromIDOrElement("quotation_total");
        list.innerHTML = "";
        var total = 0;

        if (selectedClient) {
            list.innerHTML += `<li style="background: #f8fafc; border-bottom: 2px solid var(--border);">
                <strong style="color: var(--primary)">Client: ${selectedClient.name}</strong><br>
                <small>RFC: ${selectedClient.rfc || 'N/A'}</small>
            </li>`;
        }

        selectedArticles.forEach(function(item) {
            list.innerHTML += `<li class="flex-between"><span>${item.title}</span> <span>${FormatHelper.formatCurrency(item.price)}</span></li>`;
            total += item.price;
        });
        totalEl.innerText = FormatHelper.formatCurrency(total);
    }

    async function openDialog() {
        _init();
        currentStep = 1;
        selectedClient = null;
        selectedArticles = [];
        
        selectedClient = defaultClient;

        // Reset Inputs
        var searchClientInput = dialog.querySelector('input[data-jsinput="@searchClient"]');
        if (searchClientInput) searchClientInput.value = "";
        
        var searchArticleInput = dialog.querySelector('input[data-jsinput="@filterArticles"]');
        if (searchArticleInput) searchArticleInput.value = "";

        var selectArticleType = dialog.querySelector('select[data-jschange="@filterArticles"]');
        if (selectArticleType) selectArticleType.value = "all";
        
        clientSearchResults.innerHTML = '<li class="empty-state">Type a name to search...</li>';
        
        // Fetch Data into Memory
        allClients = await DB.getAll('clients');
        
        var products = await DB.getAll('products');
        var services = await DB.getAll('services');
        
        // Combine them and tag them to avoid ID collisions
        allArticles = [];
        products.forEach(function(p) { allArticles.push(Object.assign({}, p, { _type: 'products' })); });
        services.forEach(function(s) { allArticles.push(Object.assign({}, s, { _type: 'services' })); });

        _renderArticles(allArticles);
        _updateUI();
        dialog.showModal();
    }

    function closeDialog() {
        dialog.close();
    }

    function nextStep() {
        if (currentStep < 3) currentStep++;
        _updateUI();
    }

    function prevStep() {
        if (currentStep > 1) currentStep--;
        _updateUI();
    }

    // --- Step 1: Client Actions ---

    function searchClient(event) {
        var query = event.target.value.toLowerCase();
        
        if (query.length < 2) {
            clientSearchResults.innerHTML = '<li class="empty-state">Type at least 2 characters...</li>';
            return;
        }

        var filtered = allClients.filter(function(c) {
            var name = c.name ? c.name.toLowerCase() : "";
            var rfc = c.rfc ? c.rfc.toLowerCase() : "";
            return name.indexOf(query) > -1 || rfc.indexOf(query) > -1;
        });
        
        if (filtered.length === 0) {
            clientSearchResults.innerHTML = '<li class="empty-state">No clients found. <button class="btn btn-text" data-jsclick="@createNewClient">Create one now?</button></li>';
            return;
        }

        _renderClientResults(filtered);
    }

    function _renderClientResults(filteredClients) {
        var html = "";
        filteredClients.forEach(function(c) {
            var isSelected = selectedClient && selectedClient.id === c.id;
            var borderStyle = isSelected ? "border-color: var(--primary); background-color: #eff6ff;" : "border-color: var(--border);";
            
            html += `
                <li style="cursor: pointer; padding: 1rem; border: 1px solid transparent; ${borderStyle} border-radius: var(--radius); margin-bottom: 0.5rem; transition: 0.2s;" 
                    data-jsclick="@selectClient" 
                    data-jsparams='{"id": ${c.id}}'>
                    <strong>${c.name}</strong>
                    <div style="font-size: 0.85em; color: var(--text-muted);">
                        RFC: ${c.rfc || 'N/A'} | Email: ${c.email || 'N/A'}
                    </div>
                </li>
            `;
        });
        clientSearchResults.innerHTML = html;
    }

    function selectClient(event, ctrlInstance) {
        var id = ctrlInstance.getParam("id");
        selectedClient = allClients.find(c => c.id === id);
        var searchInput = dialog.querySelector('input[data-jsinput="@searchClient"]');
        if (searchInput && searchInput.value.length >= 2) {
            searchClient({ target: searchInput });
        }
        _updateUI();
    }

    function createNewClient() {
        closeDialog();
        window.location.hash = "#clients";
    }

    // --- Step 2: Article Actions ---

    function _renderArticles(listToRender) {
        if (listToRender.length === 0) {
            articlesList.innerHTML = '<div class="empty-state" style="padding: 2rem; text-align: center;">No products or services found.</div>';
            return;
        }

        var html = "";
        listToRender.forEach(function(item) {
            // Check if this specific item is already selected
            var isChecked = selectedArticles.some(function(a) { 
                return a.id === item.id && a._type === item._type; 
            }) ? "checked" : "";
            
            var typeLabel = item._type === 'products' ? 'Product' : 'Service';
            var formattedPrice = FormatHelper.formatCurrency(item.price);

            html += `
                <label class="checkbox-item">
                    <input type="checkbox" value="${item.id}" data-type="${item._type}" data-price="${item.price}" data-title="${item.title}" data-category="${item.category || ''}" data-jschange="@toggleArticle" ${isChecked}>
                    <div style="flex-grow: 1;">
                        <strong>${item.title}</strong>
                        <div style="font-size: 0.85em; color: var(--text-muted);">
                            <span style="background: var(--background); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">${typeLabel}</span>
                            <span>${item.category || ''}</span>
                        </div>
                    </div>
                    <strong style="color: var(--success); font-size: 1.1rem;">${formattedPrice}</strong>
                </label>
            `;
        });
        articlesList.innerHTML = html;
    }

    function filterArticles() {
        // Grab values from the DOM directly since this handles both input and select events
        var searchInput = dialog.querySelector('input[data-jsinput="@filterArticles"]').value.toLowerCase();
        var typeSelect = dialog.querySelector('select[data-jschange="@filterArticles"]').value;

        var filtered = allArticles.filter(function(item) {
            var searchMatch = item.title.toLowerCase().indexOf(searchInput) > -1 || 
                              (item.category || "").toLowerCase().indexOf(searchInput) > -1;
            
            var typeMatch = typeSelect === "all" || item._type === typeSelect;
            
            return searchMatch && typeMatch;
        });

        _renderArticles(filtered);
    }

    function toggleArticle(event) {
        var target = event.target;
        var data = { 
            id: Number(target.value), 
            _type: target.getAttribute("data-type"),
            title: target.getAttribute("data-title"), 
            category: target.getAttribute("data-category"), 
            price: parseFloat(target.getAttribute("data-price")) 
        };

        if (target.checked) {
            selectedArticles.push(data);
        } else {
            // Filter out the exact item by ID AND Type
            selectedArticles = selectedArticles.filter(function(a) { 
                return !(a.id === data.id && a._type === data._type); 
            });
        }
        
        _updateUI(); // Evaluates if the "Next Step" button should be enabled
    }

    // --- Step 3: Final Actions ---
    
    async function saveQuotation() {
        // CALCULATE TOTAL FROM RAW DATA
        var computedTotal = 0;
        selectedArticles.forEach(function(article) { computedTotal += article.price; });

        var dbPayload = {
            clientId: selectedClient ? selectedClient.id : null,
            clientName: selectedClient ? selectedClient.name : "Cliente General",
            items: selectedArticles,
            total: computedTotal,
            date: new Date().toISOString()
        };

        // SAVE TO DB
        await DB.save('quotations', dbPayload);
        console.log("Quotation saved as draft.");
        
        // Refresh the list view if we are on the quotations page
        if (window.location.hash === '#quotations' || window.location.hash === '') {
            requireModule("QuotationController").init();
        }
        closeDialog();
    }

    function sendEmail() { console.log("Email Sent"); closeDialog(); }
    
    async function saveAndExport() { 
        var PDFService = requireModule("PDFService");
        
        // Retrieve business info
        var bizInfoArray = await DB.getAll('business_info');
        var bizInfo = bizInfoArray.length > 0 ? bizInfoArray[0] : null;

        // CALCULATE TOTAL FROM RAW DATA
        var computedTotal = 0;

        // --- Flags for Dynamic Notes ---
        var requiresPautaNote = false;
        var requiresHostingNote = false;
        var requiresSoftwareNote = false;

        selectedArticles.forEach(function(article) {
            computedTotal += article.price;
            // Trigger specific disclaimers based on category
            if (article.category === "Marketing") requiresPautaNote = true;
            if (article.category === "Infraestructura" || article.category === "Mantenimiento") requiresHostingNote = true;
            if (article.category === "Software" || article.category === "Desarrollo Web") requiresSoftwareNote = true;
        });

        var clientData = selectedClient || defaultClient;

        // 1. PREPARE THE DATABASE RECORD
        var dbPayload = {
            clientId: selectedClient ? selectedClient.id : null,
            clientName: selectedClient ? selectedClient.name : "Cliente General",
            clientRfc: clientData.rfc,
            items: selectedArticles,
            total: computedTotal,
            date: new Date().toISOString()
        };

        // 2. SAVE TO DATABASE FIRST! (This generates our sequential ID)
        var newQuotationId = await DB.save('quotations', dbPayload);

        // 3. PREPARE DATA FOR PDF (Using the newly created ID as the Folio)
        var quotationData = {
            folio: "COT-" + String(newQuotationId).padStart(4, '0'), // e.g., COT-0001
            company: bizInfo,
            client: clientData,
            items: selectedArticles.map(function(article) {
                return { 
                    qty: 1, 
                    title: article.title, 
                    category: article.category || "Servicio / Producto", 
                    price: article.price,
                    description: article.description // Pass description to PDF
                };
            }),
            total: computedTotal,
            date: dbPayload.date,
            hasPautaNote: requiresPautaNote,
            hasHostingNote: requiresHostingNote,
            hasSoftwareNote: requiresSoftwareNote
        };

        // 4. GENERATE PDF
        PDFService.generateQuotationPDF(quotationData);
        
        // 5. REFRESH UI
        if (window.location.hash === '#quotations' || window.location.hash === '') {
            // Trigger the controller to re-fetch from DB and render the list
            requireModule("QuotationController").init();
        }
        
        console.log("PDF Exported and Quotation Saved to DB successfully."); 
        closeDialog(); 
    }

    // Exports
    exports.openDialog = openDialog;
    exports.closeDialog = closeDialog;
    exports.nextStep = nextStep;
    exports.prevStep = prevStep;
    
    exports.searchClient = searchClient;
    exports.selectClient = selectClient; 
    exports.createNewClient = createNewClient;
    
    exports.filterArticles = filterArticles;
    exports.toggleArticle = toggleArticle;
    
    exports.saveQuotation = saveQuotation;
    exports.sendEmail = sendEmail;
    exports.saveAndExport = saveAndExport;
}, null);

// ==========================================
// PDF Generation Module (With Title & Folio)
// ==========================================
defineModule("PDFService", ["FormatHelper"], function(global, requireModule, requireDynamic, requireLazy, module, exports, FormatHelper) {
    'use strict';

    function safeText(val) {
        return (val === null || val === undefined) ? "" : String(val);
    }

    function generateQuotationPDF(data) {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF('p', 'mm', 'a4');

        var primaryBlue = [34, 59, 84];
        var textGray = [100, 100, 100];
        var textBlack = [50, 50, 50];
        var bgGray = [240, 240, 240];

        var comp = data.company || {};
        
        // Fallback or generated Folio if not provided explicitly
        var folioNum = data.folio ? data.folio : "COT-" + Math.floor(1000 + Math.random() * 9000);

        // --- 1. Header (Logo + Company Info) ---
        if (comp.logo) {
            doc.addImage(comp.logo, 'PNG', 15, 10, 35, 35);
        }

        // Main Document Title (Left Aligned near Logo base or Top Right)
        doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        
        // Render "Cotización" Document Title
        doc.text("COTIZACIÓN", 15, 52);

        // Company Name (Top Right)
        doc.text(safeText(comp.name), 195, 18, { align: 'right' });

        // Address & Company Metadata
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        var addr = doc.splitTextToSize(safeText(comp.address), 90);
        doc.text(addr, 195, 24, { align: 'right' });

        var contactParts = [];
        if (comp.rfc) contactParts.push("RFC: " + comp.rfc);
        if (comp.phone) contactParts.push("Tel: " + comp.phone);
        if (comp.email) contactParts.push(comp.email);
        
        var contactY = 24 + (addr.length * 4.5) + 2; 
        doc.text(safeText(contactParts.join(" | ")), 195, contactY, { align: 'right' });

        // Dynamic Header Divider Line Position
        var lineY = Math.max(58, contactY + 6);
        doc.setDrawColor(200, 200, 200);
        doc.line(15, lineY, 195, lineY);

        // --- 2. Client & Folio Metadata Section ---
        var section2Y = lineY + 7;
        
        doc.setFontSize(10);
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.text("CLIENTE:", 15, section2Y);
        
        // Document Metadata Blocks (Folio & Date) aligned right
        doc.text("FOLIO: " + safeText(folioNum), 195, section2Y, { align: 'right' });
        doc.text("FECHA: " + new Date(data.date).toLocaleDateString('es-MX'), 195, section2Y + 6, { align: 'right' });

        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        doc.text(safeText(data.client.name), 15, section2Y + 6);
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(textBlack[0], textBlack[1], textBlack[2]);
        doc.text("DOMICILIO: " + safeText(data.client.address), 15, section2Y + 12);
        doc.text("LUGAR: " + safeText(data.client.city || "N/A"), 15, section2Y + 18);
        doc.text("R.F.C: " + safeText(data.client.rfc), 15, section2Y + 24);

        // --- 3. Table Layout Setup ---
        var y = section2Y + 35;
        
        var colCant = 22;   
        var colDesc = 32;   
        var colCat = 118;   
        var colUnit = 172;  
        var colTotal = 195; 

        function drawTableHeader(startY) {
            doc.setFillColor(bgGray[0], bgGray[1], bgGray[2]);
            doc.rect(15, startY, 180, 10, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
            
            doc.text("Cant.", colCant, startY + 6, { align: 'center' });
            doc.text("Descripción", colDesc, startY + 6);
            doc.text("Categoría", colCat, startY + 6);
            doc.text("P. Unit.", colUnit, startY + 6, { align: 'right' });
            doc.text("Importe", colTotal, startY + 6, { align: 'right' });
            return startY + 15;
        }

        y = drawTableHeader(y);

        // --- 4. Render Table Rows ---
        data.items.forEach(function(item) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            
            var titleLines = doc.splitTextToSize(safeText(item.title), 82);
            var catLines = doc.splitTextToSize(safeText(item.category), 35);
            
            var descLines = [];
            if (item.description) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8); 
                descLines = doc.splitTextToSize(safeText(item.description), 82);
            }

            var rowHeight = (titleLines.length * 4) + (descLines.length > 0 ? (descLines.length * 3.5) + 2 : 0);
            rowHeight = Math.max(rowHeight, catLines.length * 4);
            
            if (y + rowHeight > 270) {
                doc.addPage();
                y = 15;
                y = drawTableHeader(y);
            }

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(textBlack[0], textBlack[1], textBlack[2]);

            doc.text(safeText(item.qty || 1), colCant, y, { align: 'center' });
            doc.text(titleLines, colDesc, y);
            doc.text(catLines, colCat, y);
            doc.text(FormatHelper.formatCurrency(item.price), colUnit, y, { align: 'right' });
            doc.text(FormatHelper.formatCurrency(item.price * (item.qty || 1)), colTotal, y, { align: 'right' });
            
            var currentY = y + (titleLines.length * 4);

            if (descLines.length > 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8);
                doc.setTextColor(textGray[0], textGray[1], textGray[2]);
                doc.text(descLines, colDesc, currentY);
                currentY += (descLines.length * 3.5);
            }

            y = Math.max(currentY, y + (catLines.length * 4)) + 4; 
        });

        // --- 5. Footer Totals ---
        if (y > 250) {
            doc.addPage();
            y = 20;
        }

        y += 6;
        doc.setDrawColor(100, 100, 100);
        doc.line(120, y, 195, y);
        y += 8;

        var subtotal = data.total / 1.16;
        var iva = data.total - subtotal;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(textBlack[0], textBlack[1], textBlack[2]);

        doc.text("Subtotal:", 160, y, { align: 'right' });
        doc.text(FormatHelper.formatCurrency(subtotal), 195, y, { align: 'right' });
        y += 6;
        doc.text("IVA (16%):", 160, y, { align: 'right' });
        doc.text(FormatHelper.formatCurrency(iva), 195, y, { align: 'right' });
        
        y += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        doc.text("Total:", 160, y, { align: 'right' });
        doc.text(FormatHelper.formatCurrency(data.total), 195, y, { align: 'right' });
        
        y += 8;
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.text(safeText(FormatHelper.numberToWords(data.total)), 195, y, { align: 'right' });

        // --- 6. Dynamic Professional Disclaimers System ---
        
        // Helper function to draw dynamic boxes
        function drawDisclaimerBox(title, textBody) {
            y += 8; // spacing before box
            
            // Measure text
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            var textLines = doc.splitTextToSize(textBody, 168);
            
            // Calculate Box Height based on text length (5 padding top + 5 padding bottom + line heights)
            var boxHeight = 10 + (textLines.length * 4);
            
            // Page Break Check
            if (y + boxHeight > 280) {
                doc.addPage();
                y = 20;
            }

            // Draw Background and Border
            doc.setFillColor(245, 247, 250); 
            doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
            doc.setLineWidth(0.3);
            doc.rect(15, y, 180, boxHeight, 'FD');

            // Print Title
            doc.setFont("helvetica", "bold");
            doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
            doc.text(title, 20, y + 6);

            // Print Body
            doc.setFont("helvetica", "normal");
            doc.setTextColor(textBlack[0], textBlack[1], textBlack[2]);
            doc.text(textLines, 20, y + 11);
            
            y += boxHeight; // Advance y to exactly the bottom of the box for the next one
        }

        if (data.hasPautaNote || data.hasHostingNote || data.hasSoftwareNote) {
            y += 10; // Extra padding below the totals area before the notes start
            
            if (data.hasPautaNote) {
                drawDisclaimerBox("Nota Importante sobre Campañas Digitales:", 
                "El costo cotizado en los servicios de Marketing corresponde exclusivamente a honorarios por gestión, estrategia y creación de contenido. Este monto NO incluye el presupuesto publicitario (Pauta). El presupuesto de anuncios se pagará directamente a la plataforma (Meta/Facebook) mediante el método de pago del cliente.");
            }
            if (data.hasHostingNote) {
                drawDisclaimerBox("Nota sobre Servicios de Hosting y Dominio:", 
                "Los servicios de infraestructura (Hosting, Servidores Cloud y Dominios) tienen vigencia de un (1) año a partir de su contratación. Para mantener su sitio web o sistema en línea, estos servicios requieren una renovación anual. El costo de renovación está sujeto a los precios vigentes del mercado en el momento de su vencimiento.");
            }
            if (data.hasSoftwareNote) {
                drawDisclaimerBox("Nota sobre Desarrollo y Licencias de Software:", 
                "El costo de desarrollo web o licencias de software corresponde a un pago único por la entrega del sistema actual. No incluye modificaciones estructurales futuras, rediseños, ni la póliza de soporte técnico o servidor en la nube una vez finalizado el periodo de soporte inicial incluido.");
            }
        }

        // --- Filename ---
        // 1. Normalize removes accents (ú -> u, ñ -> n)
        var normalizedName = safeText(data.client.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // 2. Replace any remaining spaces or weird symbols with underscores, and make lowercase
        var safeClientName = normalizedName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        
        // 3. Clean up multiple underscores in a row (e.g., "publico__en_general" -> "publico_en_general")
        safeClientName = safeClientName.replace(/_+/g, '_');
        
        // 4. Generate final filename
        var fileName = "cotizacion_" + safeClientName + "_" + new Date().toISOString().split('T')[0] + ".pdf";
        
        doc.save(fileName);
    }

    exports.generateQuotationPDF = generateQuotationPDF;
}, null);
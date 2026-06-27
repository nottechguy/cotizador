// ==========================================
// File: /js/ServicesView.js
// ==========================================

defineModule("ServicesController", ["$", "DatabaseService", "CSSCore"], function(global, requireModule, requireDynamic, requireLazy, module, exports, $, DB, CSSCore) {
    'use strict';

    var modal, form, listContainer, categorySelect;

    async function init() {
        modal = $.fromIDOrElement("service_modal");
        form = $.fromIDOrElement("service_form");
        listContainer = $.fromIDOrElement("services_list");
        categorySelect = $.fromIDOrElement("service_category");
        
        await populateCategories();
        await renderList();
    }

    async function populateCategories() {
        var categories = await DB.getAll('service_categories');
        var html = '<option value="">-- Select Category --</option>';
        categories.forEach(function(cat) {
            html += `<option value="${cat.name}">${cat.name}</option>`;
        });
        if (categories.length === 0) {
            html += '<option value="Desarrollo">Desarrollo</option><option value="Mantenimiento">Mantenimiento</option><option value="Marketing">Marketing</option>';
        }
        categorySelect.innerHTML = html;
    }

    async function renderList() {
        var services = await DB.getAll('services');
        
        if (services.length === 0) {
            listContainer.innerHTML = '<li class="empty-state">No services registered yet.</li>';
            return;
        }

        var html = "";
        services.forEach(function(srv) {
            var formattedPrice = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(srv.price);
            var searchString = (srv.title + " " + (srv.category || "") + " " + (srv.description || "")).toLowerCase();
            
            html += `
                <li class="flex-between" data-search="${searchString}">
                    <div>
                        <strong>${srv.title}</strong>
                        <div style="font-size: 0.85em; color: var(--text-muted); margin: 4px 0;">
                            ${srv.description || 'No description provided.'}
                        </div>
                        <div style="font-size: 0.75em;">
                            <span style="background: #eff6ff; color: var(--primary); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">${srv.category || 'Uncategorized'}</span>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <span style="font-weight: 600; color: var(--success); font-size: 1.1rem;">${formattedPrice}</span>
                        <div>
                            <button class="btn-icon" data-jsclick="@editService" data-jsparams='{"id": ${srv.id}}'>✏️</button>
                            <button class="btn-icon" data-jsclick="@deleteService" data-jsparams='{"id": ${srv.id}}'>🗑️</button>
                        </div>
                    </div>
                </li>
            `;
        });
        listContainer.innerHTML = html;
    }

    function openModal() {
        form.reset();
        $.fromIDOrElement("service_id").value = "";
        $.fromIDOrElement("service_modal_title").innerText = "Add Service";
        modal.showModal();
    }

    function closeModal() { modal.close(); }

    async function editService(event, ctrlInstance) {
        var id = ctrlInstance.getParam("id");
        var services = await DB.getAll('services');
        var srv = services.find(s => s.id === id);
        
        if (srv) {
            $.fromIDOrElement("service_id").value = srv.id;
            $.fromIDOrElement("service_title").value = srv.title;
            $.fromIDOrElement("service_desc").value = srv.description || "";
            $.fromIDOrElement("service_price").value = srv.price;
            $.fromIDOrElement("service_category").value = srv.category || "";
            
            $.fromIDOrElement("service_modal_title").innerText = "Edit Service";
            modal.showModal();
        }
    }

    async function saveService(event) {
        event.preventDefault(); 
        
        // Native Validation Enforcement
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var formData = new FormData(form);
        var serviceData = {
            title: formData.get("title").trim(),
            description: formData.get("description").trim(),
            price: parseFloat(formData.get("price")),
            category: formData.get("category")
        };

        var id = formData.get("id");
        if (id) serviceData.id = Number(id); 

        await DB.save('services', serviceData);
        closeModal();
        await renderList();
    }

    async function deleteService(event, ctrlInstance) {
        if (confirm("Are you sure you want to delete this service?")) {
            var id = ctrlInstance.getParam("id");
            await DB.remove('services', id);
            await renderList();
        }
    }

    function searchServices(event) {
        var query = event.target.value.toLowerCase();
        var items = listContainer.querySelectorAll('li:not(.empty-state)');
        
        items.forEach(function(item) {
            var searchData = item.getAttribute('data-search') || "";
            if (searchData.indexOf(query) > -1) {
                CSSCore.removeClass(item, 'hidden_ele');
            } else {
                CSSCore.addClass(item, 'hidden_ele');
            }
        });
    }

    exports.init = init;
    exports.openModal = openModal;
    exports.closeModal = closeModal;
    exports.saveService = saveService;
    exports.editService = editService;
    exports.deleteService = deleteService;
    exports.searchServices = searchServices;
}, null);


// View
defineModule("ServicesView", [], function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var viewHTML = `
        <div class="card" data-jscontroller="ServicesController">
            <div class="flex-between">
                <h2>Services Catalog</h2>
                <button class="btn btn-primary" data-jsclick="@openModal">+ Add Service</button>
            </div>
            
            <div class="filters mt-1">
                <input type="text" class="form-control" placeholder="Search services..." data-jsinput="@searchServices">
            </div>

            <ul class="item-list mt-1" id="services_list">
                <li class="empty-state">Loading...</li>
            </ul>

            <dialog id="service_modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="service_modal_title">Add Service</h2>
                        <button type="button" data-jsclick="@closeModal" class="btn-icon">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="service_form" onsubmit="requireModule('ServicesController').saveService(event)">
                            <input type="hidden" name="id" id="service_id">
                            
                            <div class="form-group">
                                <label>Service Title *</label>
                                <input type="text" name="title" id="service_title" class="form-control" required minlength="3" maxlength="100" placeholder="e.g. Web Development">
                            </div>

                            <div class="form-group">
                                <label>Description</label>
                                <textarea name="description" id="service_desc" class="form-control" rows="2" maxlength="300" placeholder="Scope of the service..."></textarea>
                            </div>
                            
                            <div class="action-grid" style="margin-top:0; gap:1rem; grid-template-columns: 1fr 1fr;">
                                <div class="form-group">
                                    <label>Base Price (MXN) *</label>
                                    <input type="number" step="0.01" min="0" name="price" id="service_price" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label>Category</label>
                                    <select name="category" id="service_category" class="form-control">
                                        <option value="">Loading...</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" style="display:none"></button>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-text" data-jsclick="@closeModal">Cancel</button>
                        <button type="submit" class="btn btn-success" form="service_form">Save Service</button>
                    </div>
                </div>
            </dialog>
        </div>
    `;

    exports.render = function(container) {
        container.innerHTML = viewHTML;
        requireModule("ServicesController").init();
    };
}, null);
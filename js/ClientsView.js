// ==========================================
// File: /js/ClientsView.js
// ==========================================

// 1. Controller for handling DOM interactions
defineModule("ClientsController", ["$", "DatabaseService", "CSSCore"], function(global, requireModule, requireDynamic, requireLazy, module, exports, $, DB, CSSCore) {
    'use strict';

    var modal, form, listContainer;

    async function init() {
        modal = $.fromIDOrElement("client_modal");
        form = $.fromIDOrElement("client_form");
        listContainer = $.fromIDOrElement("clients_list");
        await renderList();
    }

    async function renderList() {
        var clients = await DB.getAll('clients');
        
        if (clients.length === 0) {
            listContainer.innerHTML = '<li class="empty-state">No clients registered yet.</li>';
            return;
        }

        var html = "";
        clients.forEach(function(client) {
            html += `
                <li class="flex-between">
                    <div>
                        <strong>${client.name}</strong>
                        <div style="font-size: 0.85em; color: var(--text-muted);">
                            ${client.email || 'No email'} | ${client.phone || 'No phone'}
                        </div>
                    </div>
                    <div>
                        <button class="btn-icon" data-jsclick="@editClient" data-jsparams='{"id": ${client.id}}'>✏️</button>
                        <button class="btn-icon" data-jsclick="@deleteClient" data-jsparams='{"id": ${client.id}}'>🗑️</button>
                    </div>
                </li>
            `;
        });
        listContainer.innerHTML = html;
    }

    function openModal() {
        form.reset();
        $.fromIDOrElement("client_id").value = "";
        $.fromIDOrElement("client_modal_title").innerText = "Add Client";
        modal.showModal();
    }

    function closeModal() {
        modal.close();
    }

    async function editClient(event, ctrlInstance) {
        var id = ctrlInstance.getParam("id");
        var clients = await DB.getAll('clients');
        var client = clients.find(c => c.id === id);
        
        if (client) {
            $.fromIDOrElement("client_id").value = client.id;
            $.fromIDOrElement("client_name").value = client.name;
            $.fromIDOrElement("client_email").value = client.email || "";
            $.fromIDOrElement("client_phone").value = client.phone || "";
            $.fromIDOrElement("client_rfc").value = client.rfc || "";
            $.fromIDOrElement("client_address").value = client.address || "";
            
            $.fromIDOrElement("client_modal_title").innerText = "Edit Client";
            modal.showModal();
        }
    }

    async function saveClient(event) {
        event.preventDefault(); // Stop standard form submission
        
        // Native HTML5 validation check
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var formData = new FormData(form);
        var clientData = {
            name: formData.get("name"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            rfc: formData.get("rfc"),
            address: formData.get("address")
        };

        var id = formData.get("id");
        if (id) {
            clientData.id = Number(id); // Important: IndexedDB keys are strict on types
        }

        await DB.save('clients', clientData);
        closeModal();
        await renderList();
    }

    async function deleteClient(event, ctrlInstance) {
        if (confirm("Are you sure you want to delete this client?")) {
            var id = ctrlInstance.getParam("id");
            await DB.remove('clients', id);
            await renderList();
        }
    }

    async function searchClients(event) {
        var query = event.target.value.toLowerCase();
        var clients = await DB.getAll('clients');
        var items = listContainer.querySelectorAll('li:not(.empty-state)');
        
        // Simple DOM filtering
        items.forEach(function(item, index) {
            var text = clients[index].name.toLowerCase();
            if (text.indexOf(query) > -1) {
                CSSCore.show(item);
            } else {
                CSSCore.hide(item);
            }
        });
    }

    exports.init = init;
    exports.openModal = openModal;
    exports.closeModal = closeModal;
    exports.saveClient = saveClient;
    exports.editClient = editClient;
    exports.deleteClient = deleteClient;
    exports.searchClients = searchClients;

}, null);

// 2. The View Module injected by the Router
defineModule("ClientsView", [], function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var viewHTML = `
        <div class="card" data-jscontroller="ClientsController">
            <div class="flex-between">
                <h2>Clients Directory</h2>
                <button class="btn btn-primary" data-jsclick="@openModal">+ Add Client</button>
            </div>
            
            <div class="filters mt-1">
                <input type="text" class="form-control" placeholder="Search clients by name..." data-jsinput="@searchClients">
            </div>

            <ul class="item-list mt-1" id="clients_list">
                <li class="empty-state">Loading...</li>
            </ul>

            <dialog id="client_modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="client_modal_title">Add Client</h2>
                        <button data-jsclick="@closeModal" class="btn-icon">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="client_form" onsubmit="requireModule('ClientsController').saveClient(event)">
                            <input type="hidden" name="id" id="client_id">
                            
                            <div class="form-group">
                                <label>Full Name / Company Name *</label>
                                <input type="text" name="name" id="client_name" class="form-control" required>
                            </div>
                            
                            <div class="form-group">
                                <label>R.F.C (Tax ID)</label>
                                <input type="text" name="rfc" id="client_rfc" class="form-control">
                            </div>

                            <div class="action-grid" style="margin-top:0; gap:1rem; grid-template-columns: 1fr 1fr;">
                                <div class="form-group">
                                    <label>Email</label>
                                    <input type="email" name="email" id="client_email" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Phone</label>
                                    <input type="tel" name="phone" id="client_phone" class="form-control">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Address</label>
                                <input type="text" name="address" id="client_address" class="form-control">
                            </div>

                            <button type="submit" style="display:none"></button>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-text" data-jsclick="@closeModal">Cancel</button>
                        <button class="btn btn-success" type="submit" form="client_form">Save Client</button>
                    </div>
                </div>
            </dialog>
        </div>
    `;

    exports.render = function(container) {
        // Inject HTML
        container.innerHTML = viewHTML;
        
        // Initialize the controller to bind events and fetch data
        requireModule("ClientsController").init();
    };
}, null);
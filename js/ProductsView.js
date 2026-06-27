// ==========================================
// File: /js/ProductsView.js
// ==========================================

defineModule("ProductsController", ["$", "DatabaseService", "CSSCore"], function(global, requireModule, requireDynamic, requireLazy, module, exports, $, DB, CSSCore) {
    'use strict';

    var modal, form, listContainer, categorySelect;

    async function init() {
        modal = $.fromIDOrElement("product_modal");
        form = $.fromIDOrElement("product_form");
        listContainer = $.fromIDOrElement("products_list");
        categorySelect = $.fromIDOrElement("product_category");
        
        await populateCategories();
        await renderList();
    }

    async function populateCategories() {
        var categories = await DB.getAll('product_categories');
        var html = '<option value="">-- Select Category --</option>';
        categories.forEach(function(cat) {
            html += `<option value="${cat.name}">${cat.name}</option>`;
        });
        if (categories.length === 0) {
            html += '<option value="Software">Software</option><option value="Hardware">Hardware</option>';
        }
        categorySelect.innerHTML = html;
    }

    async function renderList() {
        var products = await DB.getAll('products');
        
        if (products.length === 0) {
            listContainer.innerHTML = '<li class="empty-state">No products registered yet.</li>';
            return;
        }

        var html = "";
        products.forEach(function(prod) {
            var formattedPrice = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(prod.price);
            var searchString = (prod.title + " " + (prod.category || "") + " " + (prod.description || "")).toLowerCase();
            
            html += `
                <li class="flex-between" data-search="${searchString}">
                    <div>
                        <strong>${prod.title}</strong>
                        <div style="font-size: 0.85em; color: var(--text-muted); margin: 4px 0;">
                            ${prod.description || 'No description provided.'}
                        </div>
                        <div style="font-size: 0.75em;">
                            <span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${prod.category || 'Uncategorized'}</span>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <span style="font-weight: 600; color: var(--success); font-size: 1.1rem;">${formattedPrice}</span>
                        <div>
                            <button class="btn-icon" data-jsclick="@editProduct" data-jsparams='{"id": ${prod.id}}'>✏️</button>
                            <button class="btn-icon" data-jsclick="@deleteProduct" data-jsparams='{"id": ${prod.id}}'>🗑️</button>
                        </div>
                    </div>
                </li>
            `;
        });
        listContainer.innerHTML = html;
    }

    function openModal() {
        form.reset();
        $.fromIDOrElement("product_id").value = "";
        $.fromIDOrElement("product_modal_title").innerText = "Add Product";
        modal.showModal();
    }

    function closeModal() { modal.close(); }

    async function editProduct(event, ctrlInstance) {
        var id = ctrlInstance.getParam("id");
        var products = await DB.getAll('products');
        var prod = products.find(p => p.id === id);
        
        if (prod) {
            $.fromIDOrElement("product_id").value = prod.id;
            $.fromIDOrElement("product_title").value = prod.title;
            $.fromIDOrElement("product_desc").value = prod.description || "";
            $.fromIDOrElement("product_price").value = prod.price;
            $.fromIDOrElement("product_category").value = prod.category || "";
            
            $.fromIDOrElement("product_modal_title").innerText = "Edit Product";
            modal.showModal();
        }
    }

    async function saveProduct(event) {
        event.preventDefault(); 
        
        // Native Validation Enforcement
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var formData = new FormData(form);
        var productData = {
            title: formData.get("title").trim(),
            description: formData.get("description").trim(),
            price: parseFloat(formData.get("price")),
            category: formData.get("category")
        };

        var id = formData.get("id");
        if (id) productData.id = Number(id); 

        await DB.save('products', productData);
        closeModal();
        await renderList();
    }

    async function deleteProduct(event, ctrlInstance) {
        if (confirm("Are you sure you want to delete this product?")) {
            var id = ctrlInstance.getParam("id");
            await DB.remove('products', id);
            await renderList();
        }
    }

    function searchProducts(event) {
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
    exports.saveProduct = saveProduct;
    exports.editProduct = editProduct;
    exports.deleteProduct = deleteProduct;
    exports.searchProducts = searchProducts;
}, null);

// View
defineModule("ProductsView", [], function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var viewHTML = `
        <div class="card" data-jscontroller="ProductsController">
            <div class="flex-between">
                <h2>Products Inventory</h2>
                <button class="btn btn-primary" data-jsclick="@openModal">+ Add Product</button>
            </div>
            
            <div class="filters mt-1">
                <input type="text" class="form-control" placeholder="Search products..." data-jsinput="@searchProducts">
            </div>

            <ul class="item-list mt-1" id="products_list">
                <li class="empty-state">Loading...</li>
            </ul>

            <dialog id="product_modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="product_modal_title">Add Product</h2>
                        <button type="button" data-jsclick="@closeModal" class="btn-icon">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="product_form" onsubmit="requireModule('ProductsController').saveProduct(event)">
                            <input type="hidden" name="id" id="product_id">
                            
                            <div class="form-group">
                                <label>Product Title *</label>
                                <input type="text" name="title" id="product_title" class="form-control" required minlength="3" maxlength="100" placeholder="e.g. POS Hardware">
                            </div>

                            <div class="form-group">
                                <label>Description</label>
                                <textarea name="description" id="product_desc" class="form-control" rows="2" maxlength="250" placeholder="Brief details about the product..."></textarea>
                            </div>
                            
                            <div class="action-grid" style="margin-top:0; gap:1rem; grid-template-columns: 1fr 1fr;">
                                <div class="form-group">
                                    <label>Price (MXN) *</label>
                                    <input type="number" step="0.01" min="0" name="price" id="product_price" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label>Category</label>
                                    <select name="category" id="product_category" class="form-control">
                                        <option value="">Loading...</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" style="display:none"></button>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-text" data-jsclick="@closeModal">Cancel</button>
                        <button type="submit" class="btn btn-success" form="product_form">Save Product</button>
                    </div>
                </div>
            </dialog>
        </div>
    `;

    exports.render = function(container) {
        container.innerHTML = viewHTML;
        requireModule("ProductsController").init();
    };
}, null);
// ==========================================
// File: /js/ProductCategoriesView.js
// ==========================================

defineModule("ProductCategoriesController", ["$", "DatabaseService", "CSSCore"], function(global, requireModule, requireDynamic, requireLazy, module, exports, $, DB, CSSCore) {
    'use strict';

    var modal, form, listContainer;

    async function init() {
        modal = $.fromIDOrElement("category_modal");
        form = $.fromIDOrElement("category_form");
        listContainer = $.fromIDOrElement("categories_list");
        await renderList();
    }

    async function renderList() {
        var categories = await DB.getAll('product_categories');
        
        if (categories.length === 0) {
            listContainer.innerHTML = '<li class="empty-state">No categories registered yet.</li>';
            return;
        }

        var html = "";
        categories.forEach(function(cat) {
            html += `
                <li class="flex-between">
                    <div>
                        <strong>${cat.name}</strong>
                        <div style="font-size: 0.85em; color: var(--text-muted);">
                            ${cat.description || 'No description'}
                        </div>
                    </div>
                    <div>
                        <button class="btn-icon" data-jsclick="@editCategory" data-jsparams='{"id": ${cat.id}}'>✏️</button>
                        <button class="btn-icon" data-jsclick="@deleteCategory" data-jsparams='{"id": ${cat.id}}'>🗑️</button>
                    </div>
                </li>
            `;
        });
        listContainer.innerHTML = html;
    }

    function openModal() {
        form.reset();
        $.fromIDOrElement("category_id").value = "";
        $.fromIDOrElement("category_modal_title").innerText = "Add Category";
        modal.showModal();
    }

    function closeModal() {
        modal.close();
    }

    async function editCategory(event, ctrlInstance) {
        var id = ctrlInstance.getParam("id");
        var categories = await DB.getAll('product_categories');
        var cat = categories.find(c => c.id === id);
        
        if (cat) {
            $.fromIDOrElement("category_id").value = cat.id;
            $.fromIDOrElement("category_name").value = cat.name;
            $.fromIDOrElement("category_desc").value = cat.description || "";
            
            $.fromIDOrElement("category_modal_title").innerText = "Edit Category";
            modal.showModal();
        }
    }

    async function saveCategory(event) {
        event.preventDefault(); 
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var formData = new FormData(form);
        var catData = {
            name: formData.get("name"),
            description: formData.get("description")
        };

        var id = formData.get("id");
        if (id) {
            catData.id = Number(id); 
        }

        await DB.save('product_categories', catData);
        closeModal();
        await renderList();
    }

    async function deleteCategory(event, ctrlInstance) {
        if (confirm("Are you sure you want to delete this category?")) {
            var id = ctrlInstance.getParam("id");
            await DB.remove('product_categories', id);
            await renderList();
        }
    }

    exports.init = init;
    exports.openModal = openModal;
    exports.closeModal = closeModal;
    exports.saveCategory = saveCategory;
    exports.editCategory = editCategory;
    exports.deleteCategory = deleteCategory;
}, null);


defineModule("ProductCategoriesView", [], function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var viewHTML = `
        <div class="card" data-jscontroller="ProductCategoriesController">
            <div class="flex-between">
                <h2>Product Categories</h2>
                <button class="btn btn-outline" data-jsclick="@openModal">+ Add Category</button>
            </div>
            
            <ul class="item-list mt-1" id="categories_list">
                <li class="empty-state">Loading...</li>
            </ul>

            <dialog id="category_modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="category_modal_title">Add Category</h2>
                        <button data-jsclick="@closeModal" class="btn-icon">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="category_form" onsubmit="requireModule('ProductCategoriesController').saveCategory(event)">
                            <input type="hidden" name="id" id="category_id">
                            
                            <div class="form-group">
                                <label>Category Name *</label>
                                <input type="text" name="name" id="category_name" class="form-control" required>
                            </div>
                            
                            <div class="form-group">
                                <label>Description</label>
                                <textarea name="description" id="category_desc" class="form-control" rows="2"></textarea>
                            </div>

                            <button type="submit" style="display:none"></button>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-text" data-jsclick="@closeModal">Cancel</button>
                        <button class="btn btn-success" type="submit" form="category_form">Save Category</button>
                    </div>
                </div>
            </dialog>
        </div>
    `;

    exports.render = function(container) {
        container.innerHTML = viewHTML;
        requireModule("ProductCategoriesController").init();
    };
}, null);
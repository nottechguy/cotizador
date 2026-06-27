// ==========================================
// File: /js/QuotationView.js
// ==========================================

defineModule("QuotationController", ["$", "DatabaseService", "FormatHelper", "CSSCore"], function(global, requireModule, requireDynamic, requireLazy, module, exports, $, DB, Format, CSSCore) {
    'use strict';

    var listContainer;

    async function init() {
        listContainer = $.fromIDOrElement("quotations_list");
        await renderList();
    }

    async function renderList() {
        var quotations = await DB.getAll('quotations');
        
        if (quotations.length === 0) {
            listContainer.innerHTML = '<li class="empty-state">No quotations generated yet. Start by clicking "New Quotation".</li>';
            return;
        }

        var html = "";
        quotations.sort(function(a, b) { return b.id - a.id; }).forEach(function(q) {
            var date = new Date(q.date).toLocaleDateString();
            var total = Format.formatCurrency(q.total);
            
            html += `
                <li class="flex-between">
                    <div>
                        <strong>Quotation #${q.id}</strong>
                        <div style="font-size: 0.85em; color: var(--text-muted);">
                            Date: ${date}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-weight: 600; color: var(--success);">${total}</span>
                        <button class="btn-icon" data-jsclick="@deleteQuotation" data-jsparams='{"id": ${q.id}}'>🗑️</button>
                    </div>
                </li>
            `;
        });
        listContainer.innerHTML = html;
    }

    async function deleteQuotation(event, ctrlInstance) {
        if (confirm("Delete this quotation record?")) {
            var id = ctrlInstance.getParam("id");
            await DB.remove('quotations', id);
            await renderList();
        }
    }

    // Trigger the Stepper Dialog from the QuotationView
    function openNewQuotation(event) {
        var Stepper = requireModule("QuotationStepper");
        Stepper.openDialog();
    }

    exports.init = init;
    exports.deleteQuotation = deleteQuotation;
    exports.openNewQuotation = openNewQuotation;
}, null);

defineModule("QuotationView", [], function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var viewHTML = `
        <div class="card" data-jscontroller="QuotationController">
            <div class="flex-between">
                <h2>Recent Quotations</h2>
                <button class="btn btn-primary" data-jsclick="@openNewQuotation">+ New Quotation</button>
            </div>
            
            <ul class="item-list mt-1" id="quotations_list">
                <li class="empty-state">Loading...</li>
            </ul>
        </div>
    `;

    exports.render = function(container) {
        container.innerHTML = viewHTML;
        requireModule("QuotationController").init();
    };
}, null);
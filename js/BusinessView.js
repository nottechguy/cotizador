// ==========================================
// File: /js/BusinessView.js
// ==========================================

// 1. Controller
defineModule("BusinessController", ["$", "DatabaseService", "CSSCore"], function(global, requireModule, requireDynamic, requireLazy, module, exports, $, DB, CSSCore) {
    'use strict';

    var form, logoPreview, currentLogoBase64 = "";

    async function init() {
        form = $.fromIDOrElement("business_form");
        logoPreview = $.fromIDOrElement("logo_preview");
        
        // Fetch existing business info
        var businessData = await DB.getAll('business_info');
        
        if (businessData.length > 0) {
            var data = businessData[0]; // Assume index 0 is the single business profile
            
            $.fromIDOrElement("biz_id").value = data.id;
            $.fromIDOrElement("biz_name").value = data.name || "";
            $.fromIDOrElement("biz_rfc").value = data.rfc || "";
            $.fromIDOrElement("biz_address").value = data.address || "";
            $.fromIDOrElement("biz_phone").value = data.phone || "";
            $.fromIDOrElement("biz_email").value = data.email || "";
            
            // Load existing logo
            if (data.logo) {
                currentLogoBase64 = data.logo;
                logoPreview.src = currentLogoBase64;
                CSSCore.removeClass(logoPreview, 'hidden_ele');
            }
        }
    }

    // Handles the file input change event
    function handleLogoUpload(event) {
        var file = event.target.files[0];
        if (!file) return;

        // Basic validation to ensure it's an image
        if (!file.type.match('image.*')) {
            alert("Please select a valid image file (PNG/JPG).");
            event.target.value = "";
            return;
        }

        var reader = new FileReader();
        reader.onload = function(e) {
            // e.target.result contains the Base64 string
            currentLogoBase64 = e.target.result;
            logoPreview.src = currentLogoBase64;
            CSSCore.removeClass(logoPreview, 'hidden_ele');
        };
        reader.readAsDataURL(file);
    }

    async function saveBusiness(event) {
        event.preventDefault();

        // Native HTML5 Validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var formData = new FormData(form);
        var businessData = {
            name: formData.get("name").trim(),
            rfc: formData.get("rfc").trim(),
            address: formData.get("address").trim(),
            phone: formData.get("phone").trim(),
            email: formData.get("email").trim(),
            logo: currentLogoBase64 // Save the base64 string
        };

        var id = formData.get("id");
        if (id) {
            businessData.id = Number(id); 
        }

        await DB.save('business_info', businessData);
        
        // Visual feedback
        var saveBtn = $.fromIDOrElement("btn_save_biz");
        var originalText = saveBtn.innerText;
        saveBtn.innerText = "Saved Successfully!";
        CSSCore.addClass(saveBtn, "btn-success");
        
        setTimeout(function() {
            saveBtn.innerText = originalText;
            CSSCore.removeClass(saveBtn, "btn-success");
        }, 2000);

        // Redirect if stuck on this page because of router guard
        if (window.location.hash === '#business' && !id) {
            window.location.hash = '#quotations';
        }
    }

    // Handle logo removal
    function removeLogo(event) {
        event.preventDefault();
        currentLogoBase64 = "";
        logoPreview.src = "";
        CSSCore.addClass(logoPreview, 'hidden_ele');
        $.fromIDOrElement("biz_logo_input").value = "";
    }

    exports.init = init;
    exports.saveBusiness = saveBusiness;
    exports.handleLogoUpload = handleLogoUpload;
    exports.removeLogo = removeLogo;
}, null);

// 2. View
defineModule("BusinessView", [], function(global, requireModule, requireDynamic, requireLazy, module, exports) {
    'use strict';

    var viewHTML = `
        <div class="card" data-jscontroller="BusinessController">
            <h2>Business Profile</h2>
            <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
                This information and logo will be displayed on your PDF quotations.
            </p>
            
            <form id="business_form" onsubmit="requireModule('BusinessController').saveBusiness(event)">
                <input type="hidden" name="id" id="biz_id">
                
                <div class="form-group" style="display: flex; gap: 1.5rem; align-items: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border);">
                    <div style="width: 120px; height: 120px; border: 2px dashed var(--border); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; background: var(--background); overflow: hidden; position: relative;">
                        <img id="logo_preview" class="hidden_ele" style="max-width: 100%; max-height: 100%; object-fit: contain; background: white;">
                    </div>
                    <div>
                        <label>Company Logo</label>
                        <input type="file" id="biz_logo_input" accept="image/png, image/jpeg, image/svg+xml" class="form-control" data-jschange="@handleLogoUpload" style="max-width: 300px;">
                        <div style="margin-top: 0.5rem; display: flex; gap: 1rem; align-items: center;">
                            <small style="color: var(--text-muted);">Recommended: Square PNG/JPG, transparent background.</small>
                            <button type="button" class="btn btn-text" data-jsclick="@removeLogo" style="padding: 0; font-size: 0.85rem; color: #ef4444;">Remove</button>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Company / Freelance Name *</label>
                    <input type="text" name="name" id="biz_name" class="form-control" required minlength="3" maxlength="100">
                </div>
                
                <div class="action-grid" style="margin-top:0; gap:1rem; grid-template-columns: 1fr 1fr;">
                    <div class="form-group">
                        <label>R.F.C (Tax ID)</label>
                        <input type="text" name="rfc" id="biz_rfc" class="form-control" maxlength="20">
                    </div>
                    <div class="form-group">
                        <label>Email Contact</label>
                        <input type="email" name="email" id="biz_email" class="form-control">
                    </div>
                </div>

                <div class="form-group">
                    <label>Business Phone</label>
                    <input type="tel" name="phone" id="biz_phone" class="form-control" maxlength="20">
                </div>

                <div class="form-group">
                    <label>Complete Address</label>
                    <textarea name="address" id="biz_address" class="form-control" rows="3" maxlength="200"></textarea>
                </div>

                <div style="margin-top: 2rem; text-align: right;">
                    <button type="submit" id="btn_save_biz" class="btn btn-primary">Save Business Profile</button>
                </div>
            </form>
        </div>
    `;

    exports.render = function(container) {
        container.innerHTML = viewHTML;
        requireModule("BusinessController").init();
    };
}, null);
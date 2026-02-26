sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/ushell/library"
], function (ControllerExtension, ushellLibrary) {
    "use strict";

    return ControllerExtension.extend("zdemonavigation.ext.controller.ListReport", {

        // 👉 Bắt sự kiện nhấn vào row
        onRowActionPress: function (oEvent) {
            var oSource = oEvent.getSource();
            var oCtx = oSource.getBindingContext();
            if (!oCtx) { return; }

            var sDoc = oCtx.getProperty("AccountingDocument");
            var sCompany = oCtx.getProperty("CompanyCode1");
            var sYear = oCtx.getProperty("FiscalYear");

            try {
                var oCrossAppNav = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService &&
                                    sap.ushell.Container.getService("CrossApplicationNavigation");

                if (oCrossAppNav) {
                    // Mảng semantic objects cần mở
                    var aTargets = [
                        { semanticObject: "AccountingDocument", action: "manageV2" },
                        { semanticObject: "ZSB_U4_DEMO_LINK", action: "display" } // Action tùy app bạn
                    ];

                    aTargets.forEach(function(target) {
                        oCrossAppNav.toExternal({
                            target: target,
                            params: { 
                                AccountingDocument: sDoc, 
                                CompanyCode: sCompany, 
                                FiscalYear: sYear 
                            }
                        });
                    });
                }
            } catch (e) {
                console.error(e);
            }
        },

        override: {

            onInit: function () {
                // Fiori Elements Extension API
                var oModel = this.base.getExtensionAPI().getModel();
                console.log("ListReport Controller Extension Initialized");
            },

            /*
             * Hook: Adapt navigation context/parameters for Intent-Based Navigation (IBN)
             */
            adaptNavigationContext: function (oContext, mNavigationProperties) {
                mNavigationProperties = mNavigationProperties || {};
                mNavigationProperties.parameters = mNavigationProperties.parameters || {};
                // Ví dụ thêm custom parameter
                mNavigationProperties.parameters.customParam = "customValue";
            },

            onBeforeNavigation: function (oContext, mNavigationProperties) {
                try {
                    var sDoc = oContext && oContext.getProperty && oContext.getProperty("AccountingDocument");
                    if (!sDoc) {
                        // Cancel navigation nếu không có chứng từ
                        return false;
                    }
                } catch (e) {
                    // Nếu không phải context V4, cho phép tiếp tục
                }
                return true;
            }

            // Bạn có thể thêm onAfterRendering để mở nhiều doc cùng lúc nếu muốn
        }
    });
});

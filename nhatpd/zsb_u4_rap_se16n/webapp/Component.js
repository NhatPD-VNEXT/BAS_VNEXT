sap.ui.define([
    "sap/ui/core/UIComponent",
    "zsbu4rapse16n/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("zsbu4rapse16n.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});
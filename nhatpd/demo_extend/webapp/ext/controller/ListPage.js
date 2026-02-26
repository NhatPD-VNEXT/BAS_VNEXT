sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        Create: function(oEvent) {
            MessageToast.show("Opening Create Delivery Wizard...");
            this.routing.navigateToRoute("WizardPage", { KeyID : "..." });
        }
    };
});

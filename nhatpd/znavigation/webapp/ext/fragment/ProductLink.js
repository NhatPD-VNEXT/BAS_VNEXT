sap.ui.define([
    "sap/m/Popover",
    "sap/m/Link",
    "sap/m/VBox"
], function (Popover, Link, VBox) {
    "use strict";

    function getCrossAppNav() {
        return sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");
    }

    function getNavConfig(sAction) {
        return {
            target: {
                semanticObject: "ProductionRouting",
                action: sAction
            },
            params: {
                // "C_ProductionRouting.ProductionRoutingGroup": "41500071",
                // "DYNP_NOSETGET": "1",
                // "DYNP_OKCODE": "VOUE",
                // "DynproNoFirstScreen": "1",
                // "NumberOfProducts": "1",
                // "PlantName": "JP Plant",
                // "Plant" : "1510",
                "list_KeyDate": "12/23/2025",
                // "list_ProductionRouting": "1",
                "list_ProductionRoutingGroup": "41500071"

            }
        };
    }

    var oPopover;

    return {
        onPress: function (oEvent) {
            var oSource = oEvent.getSource();

            if (!oPopover) {
                oPopover = new Popover({
                    placement: "Bottom",
                    showHeader: false,
                    content: new VBox({
                        items: [

                            new Link({
                                text: "Display Production Routing",
                                press: function () {
                                    getCrossAppNav().then(function (oNav) {
                                        oNav.toExternal(getNavConfig("display"));
                                    });
                                }
                            }),

                            new Link({
                                text: "Change Production Routing",
                                press: function () {
                                    getCrossAppNav().then(function (oNav) {
                                        oNav.toExternal(getNavConfig("change"));
                                    });
                                }
                            }),

                            new Link({
                                text: "Manage Production Routing",
                                press: function () {
                                    getCrossAppNav().then(function (oNav) {
                                        oNav.toExternal(getNavConfig("manage"));
                                    });
                                }
                            })

                        ]
                    })
                });
            }

            oPopover.openBy(oSource);
        }
    };
});
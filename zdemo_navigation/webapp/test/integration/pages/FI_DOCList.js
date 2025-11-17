sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'zdemonavigation',
            componentId: 'FI_DOCList',
            contextPath: '/FI_DOC'
        },
        CustomPageDefinitions
    );
});
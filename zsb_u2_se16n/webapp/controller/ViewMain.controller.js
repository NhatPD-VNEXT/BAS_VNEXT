sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/comp/smarttable/SmartTable",
    "sap/ui/comp/smartfilterbar/SmartFilterBar",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Button"
], (Controller, SmartTable, SmartFilterBar, MessageToast, MessageBox, Button) => {
    "use strict";

    return Controller.extend("zsbu2se16n.controller.ViewMain", {
        onInit() {
            // Initialize any required setup
        },

        onUppercaseInput: function(oEvent) {
            const input = oEvent.getSource();
            const value = input.getValue();
            input.setValue(value.toUpperCase());
        },

        onExecute: function() {
            const tableInput = this.byId("tableInput");
            const tableName = tableInput.getValue().trim();
            
            if (!tableName) {
                MessageToast.show("Please enter a table name");
                return;
            }

            // Clear any existing SmartTable
            this.clearExistingSmartTable();
            
            // Create new SmartTable dynamically
            this.createDynamicSmartTable(tableName);
        },

        clearExistingSmartTable: function() {
            const container = this.byId("smartTableContainer");
            const viewPrefixedTable = this.byId("dynamicSmartTable");
            const viewPrefixedFilterBar = this.byId("dynamicSmartFilterBar");
            const globalTable = sap.ui.getCore().byId("dynamicSmartTable");
            const globalFilterBar = sap.ui.getCore().byId("dynamicSmartFilterBar");

            if (viewPrefixedTable) { viewPrefixedTable.destroy(); }
            if (viewPrefixedFilterBar) { viewPrefixedFilterBar.destroy(); }
            if (globalTable) { globalTable.destroy(); }
            if (globalFilterBar) { globalFilterBar.destroy(); }

            if (container && container.removeAllItems) {
                container.removeAllItems();
            } else if (container && container.removeAllAggregation) {
                container.removeAllAggregation("items");
            }
        },

        createDynamicSmartTable: function(tableName) {
            try {
                const container = this.byId("smartTableContainer");
                const oModel = this.getView().getModel();
                const filterBarId = this.createId("dynamicSmartFilterBar");
                const tableId = this.createId("dynamicSmartTable");
                
                // SmartFilterBar
                const smartFilterBar = new SmartFilterBar({
                    id: filterBarId,
                    entitySet: tableName,
                    useToolbar: true,
                    persistencyKey: "SFB_" + tableName
                });
                if (oModel) {
                    smartFilterBar.setModel(oModel);
                }

                // SmartTable
                const smartTable = new SmartTable({
                    id: tableId,
                    entitySet: tableName,
                    smartFilterId: filterBarId,
                    tableType: "ResponsiveTable",
                    enableAutoBinding: true,
                    enableExport: true,
                    showRowCount: true,
                    enableAutoColumnWidth: true,
                    persistencyKey: "SmartTable_" + tableName,
                    header: tableName + " Data"
                });
                if (oModel) {
                    smartTable.setModel(oModel);
                }

                smartTable.setEditable(true);
                if (oModel && oModel.setDefaultBindingMode && sap && sap.ui && sap.ui.model && sap.ui.model.BindingMode) {
                    oModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay);
                }

                smartFilterBar.attachSearch(function() {
                    smartTable.rebindTable();
                });

                // xử lý toolbar và readonly key
                smartTable.attachInitialise(() => {
                    const toolbar = smartTable.getToolbar();
                    if (toolbar && toolbar.addContent) {
                        // lấy key property từ metadata
                        const metaModel = oModel && oModel.getMetaModel && oModel.getMetaModel();
                        let keyProps = new Set();
                        try {
                            if (metaModel && typeof metaModel.getODataEntitySet === "function" && typeof metaModel.getODataEntityType === "function") {
                                const entitySet = metaModel.getODataEntitySet(tableName);
                                const entityType = entitySet && metaModel.getODataEntityType(entitySet.entityType);
                                const keyArray = (entityType && entityType.key && entityType.key.propertyRef) ? entityType.key.propertyRef : [];
                                keyProps = new Set(keyArray.map(k => k.name));
                            }
                        } catch (e) { /* no-op */ }

                        // --- readonly key helper ---
                        const applyReadOnlyKeyFields = function(item) {
                            if (!item || typeof item.getCells !== "function" || keyProps.size === 0) { return; }
                            const cells = item.getCells();
                            let isTransient = false;
                            try {
                                const ctx = item.getBindingContext && item.getBindingContext();
                                const p = ctx && ctx.getPath && ctx.getPath();
                                const hasUid = !!(p && /\(\$uid=.*\)/.test(p));
                                const hasClientIdKey = !!(p && /\('id-[^']+'\)/.test(p));
                                const hasCreatedFlag = !!(ctx && typeof ctx.getProperty === "function" && ctx.getProperty("__metadata/created") === true);
                                isTransient = hasUid || hasClientIdKey || hasCreatedFlag;
                            } catch (e) { /* no-op */ }

                            cells.forEach((cell) => {
                                // Debug: log control type
                                if (cell) {
                                    console.log("Cell type:", cell.getMetadata && cell.getMetadata().getName());
                                    console.log("Cell ID:", cell.getId && cell.getId());
                                }
                                
                                if (cell && typeof cell.isA === "function" && cell.isA("sap.ui.comp.smartfield.SmartField")) {
                                    console.log("Found SmartField, processing...");
                                    const biValue = cell.getBindingInfo && cell.getBindingInfo("value");
                                    const biText = cell.getBindingInfo && cell.getBindingInfo("text");
                                    const path = (biValue && biValue.parts && biValue.parts[0] && biValue.parts[0].path)
                                        || (biText && biText.parts && biText.parts[0] && biText.parts[0].path);
                                    console.log("Binding path:", path, "Is key:", keyProps.has(path));
                                    if (path && keyProps.has(path)) {
                                        console.log("Processing key field, isTransient:", isTransient);
                                        // row cũ => disabled (mờ), row mới => enabled (sáng)
                                        if (typeof cell.setEnabled === "function") {
                                            cell.setEnabled(isTransient);
                                            console.log("Set enabled to:", isTransient);
                                        }
                                        if (typeof cell.setEditable === "function") {
                                            cell.setEditable(isTransient);
                                            console.log("Set editable to:", isTransient);
                                        }
                                    }
                                } else {
                                    // Try other control types that might be in cells
                                    if (cell && typeof cell.setEnabled === "function" && typeof cell.setEditable === "function") {
                                        console.log("Found other editable control:", cell.getMetadata && cell.getMetadata().getName());
                                        const biValue = cell.getBindingInfo && cell.getBindingInfo("value");
                                        const biText = cell.getBindingInfo && cell.getBindingInfo("text");
                                        const path = (biValue && biValue.parts && biValue.parts[0] && biValue.parts[0].path)
                                            || (biText && biText.parts && biText.parts[0] && biText.parts[0].path);
                                        if (path && keyProps.has(path)) {
                                            console.log("Processing key field on other control, isTransient:", isTransient);
                                            cell.setEnabled(isTransient);
                                            cell.setEditable(isTransient);
                                        }
                                    }
                                }
                            });
                        };
                        // -----------------------------

                        // inner table
                        const innerTable = smartTable.getTable && smartTable.getTable();
                        if (innerTable && typeof innerTable.setMode === "function") {
                            innerTable.setMode("MultiSelect");
                        }
                        try {
                            if (innerTable) {
                                if (typeof innerTable.getItems === "function") {
                                    innerTable.getItems().forEach(applyReadOnlyKeyFields);
                                }
                                if (typeof innerTable.attachUpdateFinished === "function") {
                                    innerTable.attachUpdateFinished(() => {
                                        if (typeof innerTable.getItems === "function") {
                                            innerTable.getItems().forEach(applyReadOnlyKeyFields);
                                        }
                                    });
                                }
                            }
                        } catch (e) { /* no-op */ }

                        // --- Save button ---
                        const saveBtn = new Button({
                            text: "Save",
                            type: "Emphasized",
                            press: () => {
                                if (oModel && typeof oModel.hasPendingChanges === "function" && !oModel.hasPendingChanges()) {
                                    MessageToast.show("No changes to save");
                                    return;
                                }
                                if (oModel && oModel.submitChanges) {
                                    oModel.submitChanges({
                                        success: (oData) => {
                                            if (typeof this.clearExistingSmartTable === "function") {
                                                this.clearExistingSmartTable();
                                            }
                                            if (typeof this.createDynamicSmartTable === "function") {
                                                this.createDynamicSmartTable(tableName);
                                            }
                                            MessageToast.show("Changes saved");
                                        },
                                        error: () => {
                                            MessageBox.error("Failed to save changes");
                                        }
                                    });
                                }
                            }
                        });
                        toolbar.addContent(saveBtn);

                        // --- Create button ---
                        const createBtn = new Button({
                            text: "Create",
                            type: "Success",
                            press: () => {
                                const isV2 = !!(oModel && typeof oModel.createEntry === "function");
                                if (!isV2) {
                                    MessageBox.error("Only OData V2 create is supported in this app.");
                                    return;
                                }

                                const tableCtrl = smartTable.getTable && smartTable.getTable();
                                if (!tableCtrl) {
                                    MessageBox.error("Table not ready for create.");
                                    return;
                                }

                                const existingItems = tableCtrl.getItems ? tableCtrl.getItems() : [];
                                for (let i = 0; i < existingItems.length; i++) {
                                    const ctx = existingItems[i].getBindingContext && existingItems[i].getBindingContext();
                                    const p = ctx && ctx.getPath && ctx.getPath();
                                    if (p && /\(\$uid=.*\)/.test(p)) {
                                        if (typeof tableCtrl.setSelectedItem === "function") {
                                            tableCtrl.setSelectedItem(existingItems[i], true);
                                        }
                                        MessageToast.show("A draft row already exists. Edit and press Save.");
                                        return;
                                    }
                                }

                                const path = "/" + tableName;
                                const newContext = oModel.createEntry(path, { properties: {}, groupId: "changes", changeSetId: "CreateSet" });

                                const bindingInfo = tableCtrl.getBindingInfo && tableCtrl.getBindingInfo("items");
                                if (!bindingInfo || !bindingInfo.template) {
                                    MessageBox.error("Cannot resolve table template for inline create.");
                                    return;
                                }

                                const newItem = bindingInfo.template.clone();
                                newItem.setBindingContext(newContext);
                                
                                if (typeof tableCtrl.insertItem === "function") {
                                    tableCtrl.insertItem(newItem, 0);
                                } else if (typeof tableCtrl.addItem === "function") {
                                    tableCtrl.addItem(newItem);
                                }

                                if (typeof tableCtrl.removeSelections === "function") {
                                    tableCtrl.removeSelections(true);
                                }

                                MessageToast.show("New draft row added. Edit and press Save.");
                                try { applyReadOnlyKeyFields(newItem); } catch (e) { /* no-op */ }
                            }
                        });
                        toolbar.addContent(createBtn);

                        // --- Delete button ---
                        const deleteBtn = new Button({
                            text: "Delete",
                            type: "Negative",
                            press: async () => {
                                const tableCtrl = smartTable.getTable && smartTable.getTable();
                                if (!tableCtrl || typeof tableCtrl.getSelectedItems !== "function") {
                                    MessageToast.show("No selection support");
                                    return;
                                }
                                const selectedItems = tableCtrl.getSelectedItems();
                                if (!selectedItems || selectedItems.length === 0) {
                                    MessageToast.show("Select rows to delete");
                                    return;
                                }

                                const confirm = await new Promise((resolve) => {
                                    MessageBox.confirm("Delete selected item(s)?", {
                                        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                                        onClose: (action) => resolve(action === MessageBox.Action.OK)
                                    });
                                });
                                if (!confirm) { return; }

                                const contexts = selectedItems.map(it => it.getBindingContext());

                                const isV2 = !!(oModel && typeof oModel.remove === "function" && typeof oModel.setDeferredGroups === "function");
                                if (isV2) {
                                    const transient = [];
                                    const persisted = [];
                                    contexts.forEach((ctx, idx) => {
                                        const path = ctx && ctx.getPath && ctx.getPath();
                                        if (!path) { return; }
                                        const hasUid = /\(\$uid=.*\)/.test(path);
                                        const hasCreatedFlag = (typeof ctx.getProperty === "function") && ctx.getProperty("__metadata/created") === true;
                                        const hasClientIdKey = /\('id-[^']+'\)/.test(path);
                                        if (hasUid || hasCreatedFlag || hasClientIdKey) {
                                            transient.push({ ctx, item: selectedItems[idx] });
                                        } else {
                                            persisted.push({ ctx, path });
                                        }
                                    });

                                    if (transient.length > 0) {
                                        transient.forEach(({ ctx, item }) => {
                                            if (typeof oModel.deleteCreatedEntry === "function") {
                                                oModel.deleteCreatedEntry(ctx);
                                            } else if (typeof oModel.resetChanges === "function") {
                                                const p = ctx.getPath && ctx.getPath();
                                                if (p) { oModel.resetChanges([p], undefined, true); }
                                            }
                                            if (tableCtrl && typeof tableCtrl.removeItem === "function" && item) {
                                                tableCtrl.removeItem(item);
                                            }
                                        });
                                    }

                                    let didPersistedDelete = false;
                                    if (persisted.length > 0) {
                                        const groupId = "deleteGroup_" + Date.now();
                                        try {
                                            const originalDeferredGroups = oModel.getDeferredGroups ? (oModel.getDeferredGroups() || []).slice() : [];
                                            const mergedGroups = [groupId].concat(originalDeferredGroups.filter(g => g !== groupId));
                                            oModel.setDeferredGroups(mergedGroups);

                                            persisted.forEach(({ path }, index) => {
                                                oModel.remove(path, {
                                                    groupId: groupId,
                                                    changeSetId: "DeleteSet_" + index
                                                });
                                            });

                                            await new Promise((resolve, reject) => {
                                                oModel.submitChanges({
                                                    groupId: groupId,
                                                    success: (oData) => resolve(oData),
                                                    error: (oError) => reject(oError)
                                                });
                                            });

                                            oModel.setDeferredGroups(originalDeferredGroups);
                                            didPersistedDelete = true;
                                        } catch (e) {
                                            const originalDeferredGroups = oModel.getDeferredGroups ? (oModel.getDeferredGroups() || []).filter(g => g !== groupId) : [];
                                            oModel.setDeferredGroups(originalDeferredGroups);
                                            MessageBox.error("Failed to delete some items");
                                        }
                                    }

                                    const selectedHasBothTypes = transient.length > 0 && persisted.length > 0;
                                    if (selectedHasBothTypes) {
                                        if (typeof this.clearExistingSmartTable === "function") {
                                            this.clearExistingSmartTable();
                                        }
                                        if (typeof this.createDynamicSmartTable === "function") {
                                            this.createDynamicSmartTable(tableName);
                                        }
                                    } else if (didPersistedDelete && typeof smartTable.rebindTable === "function") {
                                        smartTable.rebindTable();
                                    }
                                    MessageToast.show("Deleted successfully");
                                    return;
                                }
                                MessageBox.error("Only OData V2 delete is supported in this app.");
                            }
                        });
                        toolbar.addContent(deleteBtn);
                    }
                });

                container.addItem(smartFilterBar);
                container.addItem(smartTable);

                MessageToast.show("SmartTable created for " + tableName);

            } catch (error) {
                MessageBox.error("Error creating SmartTable for " + tableName + ". Please check if the table name is valid and exists in the OData service.");
            }
        }
    });
});

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/comp/smarttable/SmartTable",
    "sap/m/Button",
    "sap/m/Dialog",
    "sap/m/TextArea",
    "sap/m/Text",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/MessageBox",
    "sap/ui/core/CustomData",
    "sap/ui/comp/smartfilterbar/ControlConfiguration",
    "sap/ui/comp/smartfilterbar/SmartFilterBar"
], (Controller, JSONModel, MessageToast, SmartTable, Button, Dialog, TextArea, Text, HBox, VBox, MessageBox, CustomData, ControlConfiguration, SmartFilterBar) => {
    "use strict";

    return Controller.extend("zse16n.controller.ViewMain", {
        onInit() {
            // chỉ gắn OData model, KHÔNG initialise SmartTable ở đây
            const oModel = this.getOwnerComponent().getModel();
            this.getView().setModel(oModel);
			
			// Cấu hình để thao tác Create không tự gửi request khi tạo Context
			try {
				if (typeof oModel.setDefaultBindingMode === "function") { oModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay); }
				if (typeof oModel.setUseBatch === "function") { oModel.setUseBatch(true); }
				if (typeof oModel.setDeferredGroups === "function") { oModel.setDeferredGroups(["createLocalGroup"]); }
				if (typeof oModel.setChangeGroups === "function") {
					// Áp group tạo local cho tất cả entity set (an toàn)
					oModel.setChangeGroups({ "*": { groupId: "createLocalGroup", changeSetId: "Create", single: true } });
				}
				if (typeof oModel.setRefreshAfterChange === "function") { oModel.setRefreshAfterChange(false); }
			} catch (e) { /* ignore */ }
            this._oSmartTable = null;
            this._createdPaths = new Set();
			// JSONModel chứa các bản ghi draft (không gọi OData)
			this._oDraftModel = new JSONModel({ drafts: [] });
			try { this._oDraftModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay); } catch (e) { /* ignore */ }
			this.getView().setModel(this._oDraftModel, "draft");
			this._sDraftRowId = null;
        },

        onBeforeRebindTableDetail(oEvent) {
            const oBindingParams = oEvent.getParameter("bindingParams");
            // nếu cần thì modify filter/sort tại đây
        },

        onUppercaseInput(oEvent) {
            const sValue = oEvent.getParameter("value");
            oEvent.getSource().setValue(sValue.toUpperCase());
        },

        onExecute() {
            const oInput = this.byId("tableInput");
            const sTableName = oInput.getValue();

            if (!sTableName) {
                MessageToast.show("Please enter a table name");
                return;
            }


            const oTablePanel = this.byId("tablePanel");
            const oContainer = this.byId("smartTableContainer");

            if (oContainer && oTablePanel) {
                try {
                    oTablePanel.setHeaderText(`${sTableName} Data`);
                    // Rebuild a fresh SmartFilterBar instance like SmartTable
                    try {
                        const oPanelContent = oTablePanel.getContent && oTablePanel.getContent();
                        let oOldSfb = this.byId("sfb");
                        if (oOldSfb) {
                            try { oOldSfb.destroy(); } catch (e) { /* ignore */ }
                        }
                        const oNewSfb = new SmartFilterBar(this.createId("sfb"), { useToolbar: true, persistencyKey: `SFB_${sTableName}` });
                        // Insert SFB before the SmartTable container (first in content)
                        if (oPanelContent && oPanelContent.length) {
                            try { oTablePanel.insertContent(oNewSfb, 0); } catch (e) { /* ignore */ }
                        } else {
                            try { oTablePanel.addContent(oNewSfb); } catch (e) { /* ignore */ }
                        }
                    } catch (e) { /* ignore */ }
                    this._createSmartTable(sTableName);
                } catch (error) {
                
                    MessageToast.show(`Error loading table: ${sTableName}. Please check if the table exists.`);
                }
            }
        },

        _createSmartTable(sTableName) {

            const oContainer = this.byId("smartTableContainer");
            if (!oContainer) {
                console.error("SmartTable container not found");
                return;
            }

            // Destroy previous instance if any
            if (this._oSmartTable) {
                try { this._oSmartTable.destroy(); } catch (e) { /* ignore */ }
                this._oSmartTable = null;
            }
            this._crudToolbarAdded = false;

            // Create new SmartTable with auto binding disabled before initialisation
            const oSmartTable = new SmartTable(this.createId("tableDetail"), {
                tableType: "ResponsiveTable",
                enableExport: true,
                useVariantManagement: true,
                useTablePersonalisation: true,
                header: "Table Data",
                showRowCount: true,
                persistencyKey: `SmartTable_${sTableName}`,
                enableAutoColumnWidth: true,
                enableAutoBinding: false,
                editable: true,
                entitySet: sTableName,
                smartFilterId: this.createId("sfb")
            });
            // Bật Smart Toggle để SmartField tự động tôn trọng FieldControl từ metadata
            oSmartTable.addCustomData(new CustomData({ key: "useSmartToggle", value: true }));

            // Hook events
            oSmartTable.attachBeforeRebindTable(this.onBeforeRebindTableDetail, this);
            oSmartTable.attachInitialise(() => {
                    oSmartTable.setEnableAutoBinding(true);
                    try {
                        oSmartTable.rebindTable(true);
                    } catch (err) {
                        
                    }

                // Configure inner table selection and toolbar actions once available
                const oInnerTable = oSmartTable.getTable();
                if (oInnerTable) {
                    if (oInnerTable.isA && oInnerTable.isA("sap.m.Table") && typeof oInnerTable.setMode === "function") {
                        try {
                            oInnerTable.setMode("MultiSelect");
                        } catch (e) { /* ignore */ }
                        if (typeof oInnerTable.attachUpdateFinished === "function") {
                            oInnerTable.attachUpdateFinished(() => {
                                this._applyReadOnlyForKeys(oSmartTable);
                            });
                        }
                    } else if (typeof oInnerTable.setSelectionMode === "function") {
                        oInnerTable.setSelectionMode("MultiToggle");
                    }
                    
                    // Also react after data is received from backend to re-apply key read-only
                    this._wireDataReceived(oSmartTable);

                    // Ensure editing is enabled on the inner table
                    if (typeof oInnerTable.setEditable === "function") {
                        try {
                            oInnerTable.setEditable(true);
                        } catch (e) { /* ignore */ }
                    }
                }
                this._ensureToolbarActions(oSmartTable);
                this._applyEntitySetCapabilities(oSmartTable);
                // Force column generation based on metadata for the entity
                try { if (typeof oSmartTable.setDefaultVariant === "function") { oSmartTable.setDefaultVariant(null); } } catch (e) { /* ignore */ }
                try { if (typeof oSmartTable.applyVariant === "function") { oSmartTable.applyVariant({}); } } catch (e) { /* ignore */ }

                    setTimeout(() => {
                        this._applyReadOnlyForKeys(oSmartTable);
                    }, 200);
                });

            // Place into container
            try { oContainer.removeAllItems(); } catch (e) { /* ignore */ }
            oContainer.addItem(oSmartTable);

            // Wire SmartFilterBar for this entity set
            try {
                const oSFB = this.byId("sfb");
                const oModel = this.getView().getModel();
                if (oSFB && oModel && oModel.getMetaModel) {
                    const oMeta = oModel.getMetaModel();
                    const oEntitySet = oMeta && oMeta.getODataEntitySet && oMeta.getODataEntitySet(sTableName);
                    const sEntityType = oEntitySet && oEntitySet.entityType;
                    if (sEntityType && typeof oSFB.setEntityType === "function") {
                        oSFB.setEntityType(sEntityType);
                    }
                    if (typeof oSFB.setLiveMode === "function") { oSFB.setLiveMode(true); }
                    if (typeof oSFB.attachSearch === "function") {
                        oSFB.detachSearch(this._onSfbSearch, this);
                        oSFB.attachSearch(this._onSfbSearch, this);
                    }

                    // Reset filters and variants when entity changes to avoid stale fields/values
                    try { if (typeof oSFB.clear === "function") { oSFB.clear(); } } catch (e) { /* ignore */ }
                    try { if (typeof oSFB.setFilterData === "function") { oSFB.setFilterData({}); } } catch (e) { /* ignore */ }
                    try { if (typeof oSFB.clearVariantSelection === "function") { oSFB.clearVariantSelection(); } } catch (e) { /* ignore */ }
                    try { if (typeof oSFB.fireBeforeVariantFetch === "function") { oSFB.fireBeforeVariantFetch(); } } catch (e) { /* ignore */ }
                    try {
                        if (typeof oSFB.search === "function") { oSFB.search(); }
                        else { this._onSfbSearch(); }
                    } catch (e) { /* ignore */ }

                    // Show key fields by default in the basic area
                    try {
                        const aKeys = this._getKeyPropertyNames({ getEntitySet: () => sTableName });
                        if (Array.isArray(aKeys) && aKeys.length) {
                            // clear existing custom configs to avoid duplicates
                            if (typeof oSFB.destroyControlConfiguration === "function") {
                                oSFB.destroyControlConfiguration();
                            }
                            aKeys.forEach((sKey) => {
                                try {
                                    const oCfg = new ControlConfiguration({
                                        key: sKey,
                                        mandatory: false,
                                        visibleInAdvancedArea: false,
                                        visible: true
                                    });
                                    oSFB.addControlConfiguration(oCfg);
                                } catch (e) { /* ignore single key error */ }
                            });
                        }
                    } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }

            // Footer actions removed; Save is now in toolbar next to Create/Delete

            this._oSmartTable = oSmartTable;
        }
        ,
        _wireDataReceived(oSmartTable) {
            try {
                const oInner = oSmartTable?.getTable?.();
                const oBinding = oInner?.getBinding && oInner.getBinding("items") || oInner?.getBinding && oInner.getBinding("rows");
                if (oBinding && typeof oBinding.attachDataReceived === "function") {
                    oBinding.detachDataReceived(this._onDataReceivedApplyReadonly, this);
                    oBinding.attachDataReceived(this._onDataReceivedApplyReadonly, this);
                }
            } catch (e) { /* ignore */ }
        }
        ,
        _onDataReceivedApplyReadonly() {
            if (this._oSmartTable) {
                this._applyReadOnlyForKeys(this._oSmartTable);
            }
        }
        ,
        _getEntitySetCapabilities(oSmartTable) {
            try {
                const oModel = this.getView().getModel();
                const oMeta = oModel?.getMetaModel?.();
                const sEntitySet = oSmartTable?.getEntitySet?.();
                if (!oMeta || !sEntitySet) { return { insertable: true, updatable: true, deletable: true }; }
                const oSet = oMeta.getODataEntitySet(sEntitySet);
                // Default allow if not specified
                let insertable = true, updatable = true, deletable = true;
                // From local metadata annotations in localService: read sap: flags when present
                insertable = oSet?.['sap:creatable'] !== 'false';
                updatable = oSet?.['sap:updatable'] !== 'false';
                deletable = oSet?.['sap:deletable'] !== 'false';
                return { insertable, updatable, deletable };
            } catch (e) {
                return { insertable: true, updatable: true, deletable: true };
            }
        }
        ,
        _applyEntitySetCapabilities(oSmartTable) {
            try {
                const caps = this._getEntitySetCapabilities(oSmartTable);
                const oToolbar = oSmartTable.getToolbar && oSmartTable.getToolbar();
                if (oToolbar) {
                    const btnCreate = this.byId("btnCreate");
                    const btnDelete = this.byId("btnDelete");
                    const btnSave = this.byId("btnSave");
                    try { btnCreate?.setEnabled(!!caps.insertable); } catch (e) { /* ignore */ }
                    // Delete depends on deletable
                    try { btnDelete?.setEnabled(!!caps.deletable); } catch (e) { /* ignore */ }
                    // Save used for both create/update; keep enabled if either allowed
                    try { btnSave?.setEnabled(!!(caps.insertable || caps.updatable)); } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }
        }
        ,
        _onSfbSearch() {
            if (this._oSmartTable) {
                try { this._oSmartTable.rebindTable(true); } catch (e) { /* ignore */ }
            }
        }
        ,
        _onSavePress() {
            const oModel = this.getView().getModel();
            if (!oModel) {
                MessageBox.error("Model not found.");
                return;
            }

            const oBtn = this.byId("btnSave");
            oBtn?.setBusy(true);
            oBtn?.setEnabled(false);

            try {
                // Force refresh all bindings to ensure UI values are in model
                this._forceRefreshBindings(this._oSmartTable);
                
                // Commit UI values before submit
                this._commitEditorValues(this._oSmartTable);
                
                // Alternative method: Direct model update from UI values
                this._directModelUpdate(this._oSmartTable);


                // Build API URL
                const sApiUrl = this._buildApiUrl(oModel);
                if (!sApiUrl) {
                    oBtn?.setBusy(false);
                    oBtn?.setEnabled(true);
                    MessageBox.error("Cannot build API URL");
                    return;
                }

                // Collect data from SmartTable
                let aData = this._collectTableData(oModel);
                // Merge draft JSONModel data as create candidates
                const aDraftItems = this._getDraftItems();
                if (aDraftItems && aDraftItems.length) {
                    aData = (aData || []).concat(aDraftItems);
                }
                
                
                if (!aData || aData.length === 0) {
                    oBtn?.setBusy(false);
                    oBtn?.setEnabled(true);
                    MessageToast.show("No data to save");
                    return;
                }

                // Call API POST
                this._callApiPostWithAuth(sApiUrl, aData, oBtn);

            } catch (error) {
                
                oBtn?.setBusy(false);
                oBtn?.setEnabled(true);
                MessageBox.error("Save failed: " + error.message);
            }
        }
        ,
        _commitEditorValues(oSmartTable) {
            if (!oSmartTable?.getTable?.()) return;
            
            const oModel = this.getView().getModel();
            const oInner = oSmartTable.getTable();
            if (!oInner || !oModel) return;

            const commitValue = (oCtrl, sProp) => {
                try {
                    const oBinding = oCtrl.getBinding?.(sProp);
                    const oCtx = oCtrl.getBindingContext?.();
                    if (!oBinding || !oCtx || !oBinding.getPath?.()) return;
                    
                    let v;
                    if (oCtrl.isA?.("sap.m.DatePicker")) {
                        v = oCtrl.getDateValue?.();
                    } else {
                        const getter = `get${sProp.charAt(0).toUpperCase()}${sProp.slice(1)}`;
                        v = oCtrl[getter]?.();
                    }
                    
                    if (v !== undefined) {
                        const vNorm = this._normalizeValueForEdmType(oSmartTable, oBinding.getPath(), v);
                        oModel.setProperty(oBinding.getPath(), vNorm, oCtx, true);
                    }
                } catch (e) {
                    console.error("Error committing value:", e);
                }
            };

            const commitSmartField = (oSF) => {
                try {
                    const oCtx = oSF.getBindingContext?.();
                    const sPath = oSF.getBindingPath?.("value");
                    
                    if (!oCtx || !sPath) {
                        console.warn("SmartField missing context or path:", { 
                            hasContext: !!oCtx, 
                            path: sPath,
                            id: oSF.getId?.()
                        });
                        return;
                    }

                    // Try inner controls first
                    const aInner = oSF.getInnerControls?.() || [];
                    
                    let bCommitted = false;
                    for (const innerCtrl of aInner) {
                        if (innerCtrl?.getBinding?.("dateValue")) {
                            commitValue(innerCtrl, "dateValue");
                            bCommitted = true;
                            break;
                        } else if (innerCtrl?.getBinding?.("value")) {
                            commitValue(innerCtrl, "value");
                            bCommitted = true;
                            break;
                        } else if (innerCtrl?.getBinding?.("selectedKey")) {
                            commitValue(innerCtrl, "selectedKey");
                            bCommitted = true;
                            break;
                        }
                    }
                    
                    // Fallback to SmartField direct value
                    if (!bCommitted) {
                        const v = oSF.getValue?.();
                        if (v !== undefined) {
                            const vNorm = this._normalizeValueForEdmType(oSmartTable, sPath, v);
                            oModel.setProperty(sPath, vNorm, oCtx, true);
                        } else {
                            console.warn("No value found in SmartField:", oSF.getId?.());
                        }
                    }
                } catch (e) {
                    console.error("Error committing SmartField:", e);
                }
            };

            const processCells = (aCells) => {
                if (!aCells || !Array.isArray(aCells)) {
                    console.warn("Invalid cells array:", aCells);
                    return;
                }
                
                console.log(`Processing ${aCells.length} cells`);
                aCells.forEach((c, index) => {
                    if (!c) {
                        console.warn(`Cell ${index} is null/undefined`);
                        return;
                    }
                    
                    console.log(`Processing cell ${index}:`, { 
                        type: c.getMetadata?.()?.getName?.(),
                        id: c.getId?.(),
                        isSmartField: c.isA?.("sap.ui.comp.smartfield.SmartField")
                    });
                    
                    if (c.isA?.("sap.ui.comp.smartfield.SmartField")) {
                        commitSmartField(c);
                    } else if (c.getBinding?.("value")) {
                        commitValue(c, "value");
                    } else if (c.getBinding?.("selectedKey")) {
                        commitValue(c, "selectedKey");
                    } else if (c.getBinding?.("dateValue")) {
                        commitValue(c, "dateValue");
                    } else {
                        console.warn(`No binding found for cell ${index}:`, c.getId?.());
                    }
                });
            };

            // Process table items
            if (oInner.isA?.("sap.m.Table")) {
                const aItems = oInner.getItems?.() || [];
                
                aItems.forEach((item, index) => {
                    processCells(item.getCells?.());
                });
            } else if (oInner.getRows) {
                const aRows = oInner.getRows() || [];
                aRows.forEach((row, index) => {
                    processCells(row.getCells?.());
                });
            } else {
                console.warn("Unknown table type:", oInner.getMetadata?.()?.getName?.());
            }
            
            
        }
        ,
        _forceRefreshBindings(oSmartTable) {
            if (!oSmartTable?.getTable?.()) return;
            
            const oInner = oSmartTable.getTable();
            if (!oInner) return;

            

            const refreshControl = (oCtrl) => {
                try {
                    // Force refresh value binding
                    if (oCtrl.getBinding?.("value")) {
                        oCtrl.getBinding("value").refresh?.();
                    }
                    if (oCtrl.getBinding?.("selectedKey")) {
                        oCtrl.getBinding("selectedKey").refresh?.();
                    }
                    if (oCtrl.getBinding?.("dateValue")) {
                        oCtrl.getBinding("dateValue").refresh?.();
                    }
                    
                    // For SmartField, also try to refresh its binding
                    if (oCtrl.isA?.("sap.ui.comp.smartfield.SmartField")) {
                        const oBinding = oCtrl.getBinding?.("value");
                        if (oBinding) {
                            oBinding.refresh?.();
                        }
                        
                        // Also refresh inner controls
                        const aInner = oCtrl.getInnerControls?.() || [];
                        aInner.forEach(refreshControl);
                    }
                } catch (e) {
                    console.warn("Error refreshing control binding:", e);
                }
            };

            const refreshRow = (oRow) => {
                const aCells = oRow.getCells?.() || [];
                aCells.forEach(refreshControl);
            };

            // Refresh all rows
            if (oInner.isA?.("sap.m.Table")) {
                const aItems = oInner.getItems?.() || [];
                
                aItems.forEach(refreshRow);
            } else if (oInner.getRows) {
                const aRows = oInner.getRows() || [];
                
                aRows.forEach(refreshRow);
            }

            
        }
        ,
        _directModelUpdate(oSmartTable) {
            if (!oSmartTable?.getTable?.()) return;
            
            const oModel = this.getView().getModel();
            const oInner = oSmartTable.getTable();
            if (!oInner || !oModel) return;

            

            const updateFromControl = (oCtrl, oRowCtx) => {
                try {
                    if (!oRowCtx) return;
                    
                    // Get control value
                    let v;
                    if (oCtrl.isA?.("sap.ui.comp.smartfield.SmartField")) {
                        v = oCtrl.getValue?.();
                    } else if (oCtrl.isA?.("sap.m.Input")) {
                        v = oCtrl.getValue?.();
                    } else if (oCtrl.isA?.("sap.m.DatePicker")) {
                        v = oCtrl.getDateValue?.();
                    } else if (oCtrl.isA?.("sap.m.Select")) {
                        v = oCtrl.getSelectedKey?.();
                    } else {
                        return;
                    }
                    
                    if (v === undefined || v === null) return;
                    
                    // Get binding path
                    let sPath;
                    if (oCtrl.isA?.("sap.ui.comp.smartfield.SmartField")) {
                        sPath = oCtrl.getBindingPath?.("value");
                    } else if (oCtrl.getBinding?.("value")) {
                        sPath = oCtrl.getBinding("value").getPath?.();
                    } else if (oCtrl.getBinding?.("selectedKey")) {
                        sPath = oCtrl.getBinding("selectedKey").getPath?.();
                    } else if (oCtrl.getBinding?.("dateValue")) {
                        sPath = oCtrl.getBinding("dateValue").getPath?.();
                    }
                    
                    if (sPath) {
                        const vNorm = this._normalizeValueForEdmType(oSmartTable, sPath, v);
                        oModel.setProperty(sPath, vNorm, oRowCtx, true);
                
                    }
                } catch (e) {
                    console.warn("Error in direct model update:", e);
                }
            };

            const updateRow = (oRow) => {
                const oRowCtx = oRow.getBindingContext?.();
                if (!oRowCtx) return;
                
                const aCells = oRow.getCells?.() || [];
                aCells.forEach(oCell => updateFromControl(oCell, oRowCtx));
            };

            // Update all rows
            if (oInner.isA?.("sap.m.Table")) {
                const aItems = oInner.getItems?.() || [];
                
                aItems.forEach(updateRow);
            } else if (oInner.getRows) {
                const aRows = oInner.getRows() || [];
                
                aRows.forEach(updateRow);
            }

            
        }
        ,
        _getKeyPropertyNames(oSmartTable) {
            const oModel = this.getView().getModel();
            if (!oModel?.getMetaModel) return [];
            
            const oMeta = oModel.getMetaModel();
            const sEntitySet = oSmartTable?.getEntitySet?.();
            if (!sEntitySet) return [];
            
            const oEntitySet = oMeta.getODataEntitySet(sEntitySet);
            const oEntityType = oMeta.getODataEntityType(oEntitySet?.entityType);
            return (oEntityType?.key?.propertyRef || []).map(k => k.name).filter(Boolean);
        }
        ,
        _getEntityPropertyMap(oSmartTable) {
            try {
                const oModel = this.getView().getModel();
                const oMeta = oModel?.getMetaModel?.();
                const sEntitySet = oSmartTable?.getEntitySet?.();
                if (!oMeta || !sEntitySet) { return {}; }
                const oSet = oMeta.getODataEntitySet(sEntitySet);
                const oType = oMeta.getODataEntityType?.(oSet?.entityType);
                const map = {};
                (oType?.property || []).forEach(p => {
                    map[p.name] = {
                        edmType: p.type,
                        precision: p.precision,
                        scale: p.scale,
                        maxLength: p.maxLength,
                        nullable: p.nullable !== false
                    };
                });
                return map;
            } catch (e) {
                return {};
            }
        }
        ,
        _coerceValuePerMetadata(oSmartTable, sPropName, v) {
            try {
                const mProps = this._getEntityPropertyMap(oSmartTable);
                const meta = mProps[sPropName];
                if (!meta) { return v; }
                const t = meta.edmType || "";

                // Empty string handling: treat as undefined so it will be omitted from payload
                if (v === "") {
                    return undefined;
                }

                // Boolean coercion
                if (t === "Edm.Boolean") {
                    if (v == null) return v;
                    if (typeof v === "boolean") return v;
                    const s = String(v).trim().toLowerCase();
                    if (s === "x" || s === "true" || s === "1") return true;
                    if (s === "" || s === "false" || s === "0") return false;
                    return !!v;
                }

                // Integer/Byte coercion
                if (t === "Edm.Byte" || t === "Edm.Int16" || t === "Edm.Int32") {
                    if (v == null || v === "") return undefined;
                    const num = typeof v === "number" ? v : Number(String(v).replace(/\s|,/g, ""));
                    if (isNaN(num)) return undefined;
                    const n = Math.trunc(num);
                    if (t === "Edm.Byte") {
                        return Math.max(0, Math.min(255, n));
                    }
                    return n;
                }

                // Decimal/Double/Single coercion
                if (t === "Edm.Decimal" || t === "Edm.Double" || t === "Edm.Single") {
                    if (v == null || v === "") return undefined;
                    const num = typeof v === "number" ? v : Number(String(v).replace(/\s|,/g, ""));
                    if (isNaN(num)) return undefined;
                    const scale = typeof meta.scale === "number" ? meta.scale : undefined;
                    return typeof scale === "number" ? Number(num.toFixed(scale)) : num;
                }

                // Date types -> SAP V2 /Date(ts)/
                if (t === "Edm.DateTime" || t === "Edm.DateTimeOffset" || t === "Edm.Date") {
                    if (v == null || v === "") return undefined;
                    return this._formatDateForSAP(v);
                }

                // Default: return as-is
                return v;
            } catch (e) {
                return v;
            }
        }
        ,
        _getColumnPropertyNames(oSmartTable) {
            try {
                const oInner = oSmartTable?.getTable?.();
                const mProps = this._getEntityPropertyMap(oSmartTable);
                const aAllProps = Object.keys(mProps);
                if (!oInner || !oInner.isA?.("sap.m.Table")) { return aAllProps; }
                const aCols = oInner.getColumns?.() || [];
                const aNames = aCols.map(col => {
                    // 1) Try SmartField template binding path
                    try {
                        const tpl = col.getTemplate?.();
                        if (tpl?.isA?.("sap.ui.comp.smartfield.SmartField")) {
                            const p = tpl.getBindingPath?.("value");
                            if (p && mProps[p]) { return p; }
                        }
                    } catch (e) { /* ignore */ }
                    // 2) Try p13nData custom data from SmartTable generated columns
                    try {
                        const cds = col.getCustomData?.() || [];
                        for (const cd of cds) {
                            const key = cd.getKey?.();
                            if (key === "p13nData") {
                                const val = cd.getValue?.();
                                let obj = val;
                                if (typeof val === "string") {
                                    try { obj = JSON.parse(val); } catch (e) { obj = null; }
                                }
                                const prop = obj?.leadingProperty || obj?.columnKey;
                                if (prop && mProps[prop]) { return prop; }
                            }
                        }
                    } catch (e) { /* ignore */ }
                    // 3) Fallback to header text if matches a property
                    try {
                        const text = col.getHeader?.()?.getText?.();
                        if (text && mProps[text]) { return text; }
                    } catch (e) { /* ignore */ }
                    // 4) Final fallback: undefined (will be filtered)
                    return undefined;
                }).filter(Boolean);
                // Ensure uniqueness and keep order
                const seen = new Set();
                const ordered = [];
                for (const n of aNames) { if (!seen.has(n)) { seen.add(n); ordered.push(n); } }
                return ordered.length ? ordered : aAllProps;
            } catch (e) {
                return [];
            }
        }
        ,
        _getDefaultValueForEdm(propMeta) {
            const t = propMeta?.edmType || "";
            if (t === "Edm.Boolean") return false;
            if (t.startsWith("Edm.Int") || t === "Edm.Decimal" || t === "Edm.Double" || t === "Edm.Single") return "";
            if (t === "Edm.DateTime" || t === "Edm.DateTimeOffset" || t === "Edm.Date") return null;
            return "";
        }
        ,
        _createDraftCellForProperty(propName, propMeta, sDraftId) {
            try {
                const t = propMeta?.edmType || "";
                if (t === "Edm.DateTime" || t === "Edm.DateTimeOffset" || t === "Edm.Date") {
                    const dp = new sap.m.DatePicker({
                        valueFormat: "yyyy-MM-dd",
                        displayFormat: "yyyy-MM-dd",
                        dateValue: sDraftId ? `{draft>/${sDraftId}/${propName}}` : `{draft>${propName}}`
                    });
                    dp.setWidth("100%");
                    return dp;
                }
                const inputType = (t.startsWith("Edm.Int") || t === "Edm.Decimal" || t === "Edm.Double" || t === "Edm.Single") ? sap.m.InputType.Number : sap.m.InputType.Text;
                const inp = new sap.m.Input({ value: sDraftId ? `{draft>/${sDraftId}/${propName}}` : `{draft>${propName}}`, type: inputType });
                inp.setWidth("100%");
                return inp;
            } catch (e) {
                const inp = new sap.m.Input({ value: sDraftId ? `{draft>/${sDraftId}/${propName}}` : `{draft>${propName}}` });
                inp.setWidth("100%");
                return inp;
            }
        }
        ,
        _applyReadOnlyForKeys(oSmartTable) {
            const aKeys = this._getKeyPropertyNames(oSmartTable);
            if (!aKeys.length) return;

            const oInner = oSmartTable.getTable();
            if (!oInner) return;

            const processCell = (oCell, bIsNew, sPath) => {
                if (!sPath || !aKeys.includes(sPath)) return;

                // Enforce read-only for existing rows; allow edit for new/draft rows
                if (oCell.isA?.("sap.ui.comp.smartfield.SmartField")) {
                    try { oCell.setEditable(bIsNew); } catch (e) { /* ignore */ }
                    try { oCell.setEnabled?.(!!bIsNew); } catch (e) { /* ignore */ }
                    // Also enforce on inner controls rendered by SmartField
                    const aInner = oCell.getInnerControls?.() || [];
                    aInner.forEach((ctrl) => {
                        try { ctrl.setEditable?.(bIsNew); } catch (e1) { /* ignore */ }
                        try { ctrl.setEnabled?.(!!bIsNew); } catch (e2) { /* ignore */ }
                    });
                    this._highlightKeyField(oCell, false);
                } else if (oCell.isA?.("sap.m.Input")) {
                    try { oCell.setEditable(bIsNew); } catch (e) { /* ignore */ }
                    try { oCell.setEnabled?.(!!bIsNew); } catch (e) { /* ignore */ }
                } else if (oCell.isA?.("sap.m.DatePicker")) {
                    try { oCell.setEditable(bIsNew); } catch (e) { /* ignore */ }
                    try { oCell.setEnabled?.(!!bIsNew); } catch (e) { /* ignore */ }
                } else if (oCell.isA?.("sap.m.Select")) {
                    try { oCell.setEnabled?.(!!bIsNew); } catch (e) { /* ignore */ }
                }
            };

            const processRow = (oRow) => {
                const oCtx = oRow.getBindingContext?.();
                const sPathCtx = oCtx?.getPath?.();
                // Treat rows bound to the draft JSONModel as new rows (allow key edits)
                const oDraftCtx = oRow.getBindingContext && oRow.getBindingContext("draft");
                const bIsNew = !!oDraftCtx || oCtx?.isTransient?.() || this._createdPaths?.has(sPathCtx) || 
                              (sPathCtx && sPathCtx.includes("('')")) || oCtx?._isNewRecord;
                
                oRow.getCells?.().forEach(oCell => {
                    const sPath = oCell.isA?.("sap.ui.comp.smartfield.SmartField") ? 
                                  oCell.getBindingPath?.("value") : 
                                  oCell.getBinding?.("value")?.getPath?.();
                    processCell(oCell, bIsNew, sPath);
                });
            };

            const aItems = oInner.isA?.("sap.m.Table") ? 
                          (oInner.getItems?.() || []) : 
                          (oInner.getRows?.() || []);
            aItems.forEach(processRow);
        }
        ,
        _highlightKeyField(oControl, bHighlight) {
            if (!oControl) return;
            
            if (bHighlight) {
                oControl.addStyleClass("keyFieldHighlight");
                oControl.setBackgroundColor?.("#FFF2CC");
                oControl.setBorderColor?.("#FFC107");
            } else {
                oControl.removeStyleClass("keyFieldHighlight");
                oControl.setBackgroundColor?.("");
                oControl.setBorderColor?.("");
            }
            
            setTimeout(() => {
                const domRef = oControl.getDomRef?.();
                if (domRef) {
                    if (bHighlight) {
                        domRef.style.backgroundColor = "#FFF2CC";
                        domRef.style.border = "2px solid #FFC107";
                        domRef.style.boxShadow = "0 0 5px rgba(255, 193, 7, 0.5)";
                    } else {
                        domRef.style.backgroundColor = "";
                        domRef.style.border = "";
                        domRef.style.boxShadow = "";
                    }
                }
            }, 50);
        }
        ,
        _ensureToolbarActions(oSmartTable) {
            if (!oSmartTable || this._crudToolbarAdded) { return; }
            const oToolbar = oSmartTable.getToolbar && oSmartTable.getToolbar();
            if (!oToolbar) { return; }

            const oCreateBtn = new Button(this.createId("btnCreate"), {
                text: "Create",
                press: this._onCreatePress.bind(this)
            });
            const oDeleteBtn = new Button(this.createId("btnDelete"), {
                text: "Delete",
                press: this._onDeletePress.bind(this)
            });
            const oSaveBtn = new Button(this.createId("btnSave"), {
                text: "Save",
                press: this._onSavePress.bind(this)
            });

            try {
                oToolbar.addContent(new HBox({ items: [oCreateBtn, oDeleteBtn, oSaveBtn] }));
                this._crudToolbarAdded = true;
            } catch (e) {
                // fallback: add individually if HBox fails
                try { oToolbar.addContent(oCreateBtn); } catch (e2) { /* ignore */ }
                try { oToolbar.addContent(oDeleteBtn); } catch (e3) { /* ignore */ }
                try { oToolbar.addContent(oSaveBtn); } catch (e4) { /* ignore */ }
                this._crudToolbarAdded = true;
            }
        }
        ,
        _getSelectedContexts() {
            const oInner = this._oSmartTable?.getTable();
            if (!oInner) return [];

            // sap.m.Table selection
            if (oInner.isA?.("sap.m.Table")) {
                return oInner.getSelectedItems?.().map(it => it.getBindingContext?.()).filter(Boolean) || [];
            }

            // sap.ui.table.Table selection
            if (oInner.getSelectedIndices) {
                return oInner.getSelectedIndices().map(i => oInner.getContextByIndex(i)).filter(Boolean);
            }
            
            return [];
        }
        ,
        _onCreatePress() {
            const oSmartTable = this._oSmartTable;
            const oODataModel = this.getView().getModel();
            if (!oSmartTable) return;

            // Nếu đã có 1 draft row, không tạo thêm
            const aDrafts = this._oDraftModel.getProperty("/drafts") || [];
            if (this._sDraftRowId || aDrafts.length > 0) {
                MessageToast.show("Finish editing current draft first");
                return;
            }

            // Xác định danh sách property dựa theo metadata và thứ tự cột SmartTable
            const mProps = this._getEntityPropertyMap(oSmartTable);
            const aPropNames = this._getColumnPropertyNames(oSmartTable);
            const oDraft = { __isDraft: true, __op: "create" };
            aPropNames.forEach((p) => { oDraft[p] = this._getDefaultValueForEdm(mProps[p]); });

            // Thêm draft vào JSONModel
            const sDraftId = `draft_${Date.now()}`;
            this._sDraftRowId = sDraftId;
            oDraft.__id = sDraftId;
            this._oDraftModel.setProperty("/drafts", [oDraft]);

            // Chèn 1 dòng vào bảng hiển thị từ JSONModel
                const oInner = oSmartTable.getTable?.();
            if (!oInner || !oInner.isA?.("sap.m.Table")) {
                MessageBox.error("Draft row only supported on sap.m.Table in this implementation.");
                return;
            }

            // Tạo sap.m.ColumnListItem với các Input bound vào model "draft"
            const aColumns = oInner.getColumns?.() || [];
            const aCells = (aColumns || []).map((col, idx) => {
                const sProp = aPropNames[idx];
                // Binding tương đối theo row context: `{draft>${sProp}}`
                const cell = this._createDraftCellForProperty(sProp, mProps[sProp], null /* use relative */);
                // Sửa binding path của cell về relative nếu hàm trên tạo absolute
                try {
                    if (cell.isA && cell.isA("sap.m.DatePicker")) {
                        const b = cell.getBinding("dateValue"); if (b) { cell.bindProperty("dateValue", { path: sProp, model: "draft" }); }
                    } else if (cell.isA && cell.isA("sap.m.Input")) {
                        const b = cell.getBinding("value"); if (b) { cell.bindProperty("value", { path: sProp, model: "draft" }); }
                    }
                } catch (e) { /* ignore */ }
                return cell;
            });

            const oItem = new sap.m.ColumnListItem({ cells: aCells });
            oItem.addStyleClass("draft-row");
            // Đặt context của row vào phần tử draft đầu tiên
            oItem.setBindingContext(new sap.ui.model.Context(this._oDraftModel, "/drafts/0"), "draft");
            oInner.addItem(oItem);

            // Allow editing key fields on the newly created draft row
            try { this._applyReadOnlyForKeys(oSmartTable); } catch (e) { /* ignore */ }
        }
        ,
        _onDeletePress() {
            const aCtx = this._getSelectedContexts();
            if (!aCtx.length) {
                MessageToast.show("Select rows to delete");
                return;
            }
            MessageBox.confirm(`Delete ${aCtx.length} record(s)?`, {
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK && sAction !== "OK") { return; }
                    try {
                        const oModel = this.getView().getModel();
                        if (!oModel || typeof oModel.remove !== "function") {
                            MessageBox.error("OData V2 model required for delete.");
                            return;
                        }

                        // Send DELETE requests without $batch to avoid backend dump
                        const sEntitySet = this._oSmartTable && this._oSmartTable.getEntitySet && this._oSmartTable.getEntitySet();
                        const bPrevBatch = typeof oModel.getUseBatch === "function" ? oModel.getUseBatch() : true;
                        if (typeof oModel.setUseBatch === "function") { try { oModel.setUseBatch(false); } catch (e) { /* ignore */ } }

                        const aPromises = [];
                        for (const ctx of aCtx) {
                            try {
                                const oObj = ctx.getObject && ctx.getObject();
                                if (oObj && Object.prototype.hasOwnProperty.call(oObj, "Delete_mc") && !oObj.Delete_mc) { continue; }
                                // Prefer context path; otherwise build from keys
                                let sPath = ctx && ctx.getPath && ctx.getPath();
                                if (!sPath && sEntitySet && typeof oModel.createKey === "function") {
                                    const aKeys = this._getKeyPropertyNames({ getEntitySet: () => sEntitySet });
                                    const mKeyVals = {};
                                    (aKeys || []).forEach((k) => { if (oObj && Object.prototype.hasOwnProperty.call(oObj, k)) { mKeyVals[k] = oObj[k]; } });
                                    const sKey = oModel.createKey(sEntitySet, mKeyVals);
                                    if (sKey) { sPath = `/${sKey}`; }
                                }
                                if (!sPath) { continue; }
                                if (sPath.charAt(0) !== '/') { sPath = `/${sPath}`; }
                                aPromises.push(new Promise((res, rej) => {
                                    try { oModel.remove(sPath, { eTag: "*", success: () => res(), error: (err) => rej(err) }); } catch (err) { rej(err); }
                                }));
                            } catch (e) { /* ignore row */ }
                        }
                        if (!aPromises.length) { MessageToast.show("Nothing deletable selected"); return; }
                        try { await Promise.all(aPromises); } finally { if (typeof oModel.setUseBatch === "function") { try { oModel.setUseBatch(!!bPrevBatch); } catch (e) { /* ignore */ } } }

                        // Clear selection and refresh
                        try {
                            if (this._oSmartTable) {
                                const oInner = this._oSmartTable.getTable && this._oSmartTable.getTable();
                                if (oInner) {
                                    try { if (oInner.isA && oInner.isA("sap.m.Table") && typeof oInner.removeSelections === "function") { oInner.removeSelections(true); } } catch (e1) { /* ignore */ }
                                    try { if (typeof oInner.clearSelection === "function") { oInner.clearSelection(); } } catch (e2) { /* ignore */ }
                                }
                                this._oSmartTable.rebindTable(true);
                            }
                        } catch (e) { /* ignore */ }
                        MessageToast.show("Deleted");
                    } catch (e) {
                        console.error(e);
                        MessageBox.error("Delete failed");
                    }
                }
            });
        }
        ,
        _normalizeValueForEdmType(oSmartTable, sPath, v) {
            if (v == null) return v;
            
            try {
                const oMeta = this.getView().getModel()?.getMetaModel?.();
                const sEntitySet = oSmartTable?.getEntitySet?.();
                if (!oMeta || !sEntitySet) return v;

                const oSet = oMeta.getODataEntitySet(sEntitySet);
                const oType = oMeta.getODataEntityType?.(oSet?.entityType);
                const sPropName = sPath?.split("/").pop();
                const oProp = oType?.property?.find(p => p.name === sPropName);
                const sEdmType = oProp?.type || "";

                // Handle Edm.Boolean
                if (sEdmType === "Edm.Boolean") {
                    if (typeof v === "boolean") return v;
                    const s = String(v).trim().toLowerCase();
                    if (s === "x" || s === "true" || s === "1") return true;
                    if (s === "" || s === "false" || s === "0") return false;
                    return !!v;
                }

                // Handle Edm.Byte and integer types
                if (sEdmType === "Edm.Byte" || sEdmType === "Edm.Int16" || sEdmType === "Edm.Int32") {
                    if (v === "") return undefined;
                    const num = typeof v === "number" ? v : Number(String(v).replace(/\s|,/g, ""));
                    if (isNaN(num)) return v;
                    const n = Math.trunc(num);
                    return sEdmType === "Edm.Byte" ? Math.max(0, Math.min(255, n)) : n;
                }

                // Handle Edm.Decimal with precision and scale
                if (sEdmType === "Edm.Decimal") {
                    if (typeof v === "string") {
                        // Remove spaces and commas, then parse
                        const cleanValue = v.replace(/\s|,/g, "");
                        const num = parseFloat(cleanValue);
                        
                        if (!isNaN(num)) {
                            // For decimal values, ensure proper formatting
                            // For NetValue (curr23.2), use scale 2, not from metadata
                            const precision = oProp?.precision || 13;
                            const scale = sPropName === "NetValue" ? 2 : (oProp?.scale || 3);
                            
                            // Format to the required scale (decimal places)
                            const formattedValue = parseFloat(num.toFixed(scale));
                            return formattedValue;
                        }
                        return v;
                    } else if (typeof v === "number") {
                        // Ensure number is properly formatted for decimal
                        const scale = sPropName === "NetValue" ? 2 : (oProp?.scale || 3);
                        return parseFloat(v.toFixed(scale));
                    }
                }
                
                // Handle other numeric types
                if (sEdmType.match(/^Edm\.(Double|Single|Int)/)) {
                    if (typeof v === "string") {
                        const n = Number(v.replace(/\s|,/g, ""));
                        return !isNaN(n) ? n : v;
                    }
                }

                return v;
            } catch (e) {
                console.warn("Error normalizing value for EDM type:", e);
                return v;
            }
        }
        ,
        _buildApiUrl(oModel) {
            try {
                // Lấy base URL từ model
                const sServiceUrl = oModel.getServiceUrl?.() || oModel.sServiceUrl || "";
                if (!sServiceUrl) {
                    console.error("Service URL not found in model");
                    return null;
                }

                // Lấy entity set name từ SmartTable
                const sEntitySet = this._oSmartTable?.getEntitySet?.();
                if (!sEntitySet) {
                    console.error("Entity set not found");
                    return null;
                }

                // Đảm bảo base URL kết thúc bằng '/' và entity set không bắt đầu bằng '/'
                const sCleanServiceUrl = sServiceUrl.endsWith('/') ? sServiceUrl : sServiceUrl + '/';
                const sCleanEntitySet = sEntitySet.startsWith('/') ? sEntitySet.substring(1) : sEntitySet;

                // Xây dựng URL đầy đủ
                // Ví dụ: http://localhost:52118/testclient/sap/opu/odata/sap/ZSB_U2_SE16N_01/ZDATASPHERE
                const sApiUrl = `${sCleanServiceUrl}${sCleanEntitySet}`;
                console.log("Built API URL:", sApiUrl);
                return sApiUrl;
            } catch (error) {
                console.error("Error building API URL:", error);
                return null;
            }
        }
        ,
        _collectTableData(oModel) {
            try {
                const sEntitySet = this._oSmartTable?.getEntitySet?.();
                if (!sEntitySet) {
                    console.error("Entity set not found");
                    return [];
                }

                const oInner = this._oSmartTable?.getTable?.();
                if (!oInner) {
                    console.error("Inner table not found");
                    return [];
                }

                const aData = [];
                
                // Lấy data trực tiếp từ table rows
                const aRows = this._getTableRows(oInner);
                
                
                aRows.forEach((oRow, index) => {
                    const oRowCtx = oRow.getBindingContext?.();
                    if (!oRowCtx) {
                        console.warn(`Row ${index} has no binding context`);
                        return;
                    }

                    // Lấy data từ model context
                    const obj = oRowCtx.getObject?.() || {};
                    
                    
                    // Cập nhật data từ UI controls trong row
                    const updatedObj = this._extractDataFromRow(oRow, obj, oRowCtx);
                    
                    
                    // Xác định record có phải là mới không (giống logic trong _applyReadOnlyForKeys)
                    const sPathCtx = oRowCtx.getPath?.();
                    const bIsTransient = oRowCtx.isTransient?.() || false;
                    const bInCreatedPaths = this._createdPaths?.has(sPathCtx) || false;
                    const bHasEmptyKey = sPathCtx && sPathCtx.includes("('')");
                    const bHasNewFlag = oRowCtx._isNewRecord || false;
                    const bIsNew = bIsTransient || bInCreatedPaths || bHasEmptyKey || bHasNewFlag;
                    
                    const hasChanges = bIsNew || this._hasChanges(oRowCtx) || this._hasUIValuesChanged(oRow, obj);
                    
                    
                    
                    // Đặt cờ thao tác để điều khiển POST/PATCH
                    if (bIsNew) {
                        updatedObj.__op = "create";
                    } else if (hasChanges) {
                        updatedObj.__op = "update";
                    }

                    aData.push({
                        context: oRowCtx,
                        data: updatedObj,
                        path: sPathCtx,
                        isNew: bIsNew,
                        hasChanges: hasChanges
                    });
                    
                    
                });

                
                return aData;
            } catch (error) {
                console.error("Error collecting table data:", error);
                return [];
            }
        }
        ,
        _getTableRows(oInner) {
            try {
                if (oInner.isA?.("sap.m.Table")) {
                    return oInner.getItems?.() || [];
                } else if (oInner.getRows) {
                    return oInner.getRows() || [];
                } else {
                    console.warn("Unknown table type:", oInner.getMetadata?.()?.getName?.());
                    return [];
                }
            } catch (error) {
                console.error("Error getting table rows:", error);
                return [];
            }
        }
        ,
        _extractDataFromRow(oRow, oOriginalObj, oRowCtx) {
            try {
                const oUpdatedObj = { ...oOriginalObj };
                const aCells = oRow.getCells?.() || [];
                
                aCells.forEach((oCell) => {
                    if (oCell.isA?.("sap.ui.comp.smartfield.SmartField")) {
                        const sPath = oCell.getBindingPath?.("value");
                        if (sPath) {
                            const v = oCell.getValue?.();
                            if (v !== undefined && v !== null && v !== "") {
                                const sPropName = sPath.split("/").pop();
                                oUpdatedObj[sPropName] = v;
                
                            }
                        }
                    } else if (oCell.isA?.("sap.m.Input")) {
                        const oBinding = oCell.getBinding?.("value");
                        if (oBinding) {
                            const sPath = oBinding.getPath?.();
                            const v = oCell.getValue?.();
                            if (sPath && v !== undefined) {
                                const sPropName = sPath.split("/").pop();
                                oUpdatedObj[sPropName] = v;
                                
                            }
                        }
                    } else if (oCell.isA?.("sap.m.DatePicker")) {
                        const oBinding = oCell.getBinding?.("dateValue");
                        if (oBinding) {
                            const sPath = oBinding.getPath?.();
                            const v = oCell.getDateValue?.();
                            if (sPath && v !== undefined) {
                                const sPropName = sPath.split("/").pop();
                                oUpdatedObj[sPropName] = v;
                                
                            }
                        }
                    } else if (oCell.isA?.("sap.m.Select")) {
                        const oBinding = oCell.getBinding?.("selectedKey");
                        if (oBinding) {
                            const sPath = oBinding.getPath?.();
                            const v = oCell.getSelectedKey?.();
                            if (sPath && v !== undefined) {
                                const sPropName = sPath.split("/").pop();
                                oUpdatedObj[sPropName] = v;
                                
                            }
                        }
                    }
                });
                
                return oUpdatedObj;
            } catch (error) {
                console.error("Error extracting data from row:", error);
                return oOriginalObj;
            }
        }
        ,
        _hasUIValuesChanged(oRow, oOriginalObj) {
            try {
                const oUpdatedObj = this._extractDataFromRow(oRow, oOriginalObj, null);
                
                // So sánh các giá trị để xem có thay đổi không
                for (const key in oUpdatedObj) {
                    if (oUpdatedObj.hasOwnProperty(key)) {
                        const originalValue = oOriginalObj[key];
                        const updatedValue = oUpdatedObj[key];
                        
                        // So sánh giá trị (có thể cần normalize)
                        if (this._valuesAreDifferent(originalValue, updatedValue)) {
                
                            return true;
                        }
                    }
                }
                
                return false;
            } catch (error) {
                console.error("Error checking UI values changed:", error);
                return true; // Assume changed if check fails
            }
        }
        ,
        _valuesAreDifferent(v1, v2) {
            // Normalize values for comparison
            const normalize = (val) => {
                if (val === null || val === undefined || val === "") return null;
                if (typeof val === "string") return val.trim();
                return val;
            };
            
            const n1 = normalize(v1);
            const n2 = normalize(v2);
            
            // Handle date comparison
            if (n1 instanceof Date && n2 instanceof Date) {
                return n1.getTime() !== n2.getTime();
            }
            
            return n1 !== n2;
        }
        ,
        _computeChangedNonKeyProps(oOriginalObj, oNewData, aKeyFields, oSmartTable) {
            try {
                const changed = [];
                const keys = new Set([...(Object.keys(oOriginalObj || {})), ...(Object.keys(oNewData || {}))]);
                const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
                const normalizeVal = (propName, v) => {
                    // Coerce per metadata for stable comparison
                    const coerced = this._coerceValuePerMetadata(oSmartTable, propName, v);
                    // Convert SAP V2 date string /Date(x)/ to timestamp number for comparison
                    if (typeof coerced === 'string' && /^\/Date\((\d+)\)\/$/.test(coerced)) {
                        const m = coerced.match(/^\/Date\((\d+)\)\/$/);
                        return m ? Number(m[1]) : coerced;
                    }
                    return coerced;
                };
                for (const k of keys) {
                    if (aKeyFields?.includes(k)) { continue; }
                    const v1 = oOriginalObj ? oOriginalObj[k] : undefined;
                    const v2 = oNewData ? oNewData[k] : undefined;
                    if (isEmpty(v1) && isEmpty(v2)) { continue; }
                    const n1 = normalizeVal(k, v1);
                    const n2 = normalizeVal(k, v2);
                    // Treat empty string and null as equal
                    const n1e = (n1 === '' || n1 === undefined) ? null : n1;
                    const n2e = (n2 === '' || n2 === undefined) ? null : n2;
                    if (n1e instanceof Date && !(n2e instanceof Date) && typeof n2e === 'number') {
                        if (n1e.getTime() !== n2e) { changed.push(k); }
                        continue;
                    }
                    if (n2e instanceof Date && !(n1e instanceof Date) && typeof n1e === 'number') {
                        if (n2e.getTime() !== n1e) { changed.push(k); }
                        continue;
                    }
                    if (n1e !== n2e) { changed.push(k); }
                }
                return changed;
            } catch (e) {
                // If uncertain, assume no changes to avoid unwanted PATCH
                return [];
            }
        }
        ,
        _hasChanges(ctx) {
            try {
                // Kiểm tra xem context có thay đổi hay không
                const oModel = this.getView().getModel();
                const sPath = ctx.getPath?.();
                if (!sPath) return false;

                // Kiểm tra trong pending changes của model
                if (oModel.hasPendingChanges && oModel.hasPendingChanges()) {
                    const aPendingChanges = oModel.getPendingChanges?.() || {};
                    return Object.keys(aPendingChanges).some(path => path.includes(sPath));
                }
                
                return false;
            } catch (error) {
                console.warn("Error checking changes:", error);
                return true; // Assume has changes if check fails
            }
        }
        ,
        _callApiPost(sApiUrl, aData, oBtn) {
            try {
                // Chỉ lấy những record thực sự có thay đổi hoặc là record mới
                // Loại bỏ duplicate records (cùng path)
                const uniqueData = [];
                const seenPaths = new Set();
                
                aData.forEach(item => {
                    const path = item.path;
                    if (!seenPaths.has(path)) {
                        seenPaths.add(path);
                        uniqueData.push(item);
                    } else {
                
                    }
                });
                
				// Phân loại chính xác Create/Update dựa trên key-fields và thay đổi thực sự
				const aKeyFields = this._getKeyPropertyNames(this._oSmartTable);
				const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
				
				const classify = (item) => {
					const originalObj = item.context?.getObject?.() || {};
					const data = item.data || {};
					const path = item.path || '';
					
					// Kiểm tra keys có đầy đủ không
					const keysComplete = Array.isArray(aKeyFields) && aKeyFields.length > 0
						? aKeyFields.every((k) => !isEmpty(data[k]))
						: false;
					
					// Là create nếu: context transient | path rỗng key | đã tạo mới | keys chưa đủ
					const isCreate = !!(item.isNew || path.includes("('')") || item.context?.isTransient?.() || !keysComplete);
					
					// Có thay đổi thực sự trên non-key fields?
					const hasRealChanges = (() => {
						const setOfKeys = new Set([...Object.keys(originalObj || {}), ...Object.keys(data || {})]);
						for (const key of setOfKeys) {
							if (aKeyFields.includes(key)) { continue; }
							const v1 = originalObj[key];
							const v2 = data[key];
							if (this._valuesAreDifferent(v1, v2)) { return true; }
						}
						return false;
					})();
					
					// Với create: cần có ít nhất 1 non-key field có giá trị (tránh dòng trắng)
					const hasAnyNonKeyValue = (() => {
						for (const [k, v] of Object.entries(data)) {
							if (!aKeyFields.includes(k) && !isEmpty(v)) { return true; }
						}
						return false;
					})();
					
					return { isCreate, hasRealChanges, hasAnyNonKeyValue, item };
				};
				
                const aClassified = uniqueData.map((item) => {
                    // Tôn trọng cờ __op nếu có trong dữ liệu
                    const op = item?.data?.__op;
                    if (op === "create") {
                        return { isCreate: true, hasRealChanges: true, hasAnyNonKeyValue: true, item };
                    }
                    if (op === "update") {
                        const base = classify(item);
                        return { ...base, isCreate: false };
                    }
                    return classify(item);
                });
                const aKeyFields2 = aKeyFields || [];
                const aCreateData = aClassified
                    .filter(x => x.isCreate && x.hasAnyNonKeyValue)
                    .map(x => x.item);
                // Extra strict filter: only PATCH rows with actual non-key diffs after normalization
                const aUpdateData = aClassified
                    .filter(x => !x.isCreate)
                    .map(x => {
                        const originalObj = x.item.context?.getObject?.() || {};
                        const newObj = x.item.data || {};
                        const changed = this._computeChangedNonKeyProps(originalObj, newObj, aKeyFields2, this._oSmartTable);
                        return { item: x.item, changed };
                    })
                    .filter(x => x.changed.length > 0)
                    .map(x => x.item);
				
				if (aCreateData.length === 0 && aUpdateData.length === 0) {
                    oBtn?.setBusy(false);
                    oBtn?.setEnabled(true);
                    MessageToast.show("No changes to save");
                    return;
                }

                

                // Respect entity set capabilities
                const caps = this._getEntitySetCapabilities(this._oSmartTable);

                // Xử lý Create (POST) và Update (PATCH) riêng biệt
                const aPromises = [];

                // Xử lý Create records với POST
                if (aCreateData.length > 0 && caps.insertable) {
                    aPromises.push(this._processCreateRecords(sApiUrl, aCreateData, oBtn));
                }
                if (aCreateData.length > 0 && !caps.insertable) {
                    console.warn("Skipping CREATE due to InsertRestrictions/creatable=false");
                }

                // Xử lý Update records với PATCH
                if (aUpdateData.length > 0 && caps.updatable) {
                    aPromises.push(this._processUpdateRecords(sApiUrl, aUpdateData, oBtn));
                }
                if (aUpdateData.length > 0 && !caps.updatable) {
                    console.warn("Skipping UPDATE due to UpdateRestrictions/updatable=false");
                }

                // Chờ tất cả requests hoàn thành
                Promise.all(aPromises)
                    .then(() => {
                        // On successful save, refresh data like Execute: trigger SFB search + rebind
                        oBtn?.setBusy(false);
                        oBtn?.setEnabled(true);
                        
                        // Clear created paths, draft model và reset flags để tránh duplicate
                        this._createdPaths?.clear();
                        try { this._oDraftModel.setProperty("/drafts", []); this._sDraftRowId = null; } catch (e) { /* ignore */ }
                        
                        // Reset _isNewRecord flags trên tất cả contexts
                        const oInner = this._oSmartTable?.getTable?.();
                        if (oInner) {
                            const aItems = oInner.isA?.("sap.m.Table") ? 
                                          (oInner.getItems?.() || []) : 
                                          (oInner.getRows?.() || []);
                            aItems.forEach(oRow => {
                                const oCtx = oRow.getBindingContext?.();
                                if (oCtx) {
                                    delete oCtx._isNewRecord;
                                }
                            });
                        }
                        
                        // Re-search via SmartFilterBar to reload from backend, then apply read-only
                        try {
                            const oSFB = this.byId("sfb");
                            if (oSFB && typeof oSFB.search === "function") {
                                oSFB.search();
                            } else if (this._oSmartTable) {
                                this._oSmartTable.rebindTable?.(true);
                            }
                        } catch (e) { /* ignore */ }
                        this._applyReadOnlyForKeys(this._oSmartTable);
                        MessageToast.show("Saved successfully");
                    })
                    .catch(error => {
                        
                        oBtn?.setBusy(false);
                        oBtn?.setEnabled(true);
                        MessageBox.error("Save failed: " + error.message);
                    });

            } catch (error) {
                console.error("Error in API call:", error);
                oBtn?.setBusy(false);
                oBtn?.setEnabled(true);
                MessageBox.error("Save failed: " + error.message);
            }
        }
        ,
        _processCreateRecords(sApiUrl, aCreateData, oBtn) {
            console.log("Processing CREATE records with POST method:", aCreateData);
            
            const aHeaders = this._getAuthHeaders();
            
            // Draft đã gộp vào aData ở _onSavePress

            // Gửi 1 POST cho mỗi record mới, bỏ qua payload trống để tránh tạo dòng trắng
            const aPromises = aCreateData.map((item, idx) => {
				// Làm sạch và format dữ liệu
				const cleanData = { ...(item?.data || {}) };
                delete cleanData.__metadata;
                delete cleanData.__op;
                // Coerce per metadata first, then format for V2
                const coerced = Object.keys(cleanData).reduce((acc, k) => {
                    const coercedVal = this._coerceValuePerMetadata(this._oSmartTable, k, cleanData[k]);
                    if (coercedVal !== undefined) { acc[k] = coercedVal; }
                    return acc;
                }, {});
                const formattedData = this._formatDataForODataV2(coerced);
				
				// Loại bỏ các field rỗng/null/"" khỏi payload
				Object.keys(formattedData).forEach((k) => {
					const v = formattedData[k];
					if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
						delete formattedData[k];
					}
				});
				
				// Bắt buộc key fields phải có giá trị
				const aKeyFields = this._getKeyPropertyNames(this._oSmartTable) || [];
				const keysComplete = aKeyFields.length === 0 ? true : aKeyFields.every((k) => {
					const v = formattedData[k];
					return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
				});
				if (!keysComplete) {
					console.warn(`Skip CREATE ${idx + 1}: missing key fields ->`, aKeyFields);
					return Promise.resolve({ skipped: true, reason: 'missing_keys' });
				}
				
				// Bỏ qua record nếu toàn bộ fields rỗng/null/""
				const hasAnyValue = Object.keys(formattedData).some((k) => {
					const v = formattedData[k];
					return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
				});
				if (!hasAnyValue) {
					console.warn(`Skip CREATE ${idx + 1}: empty payload -> avoid blank row`);
					return Promise.resolve({ skipped: true });
				}
				
				// OData V2: POST body là entity object (không cần wrapper d)
				const oPayload = formattedData;
				
				console.log(`Creating record ${idx + 1}:`, oPayload);
            
				const authHeaders = this._getAuthHeaders();
				return fetch(sApiUrl, {
                method: 'POST',
					headers: {
						'accept': 'application/json',
						'Content-Type': 'application/json',
						...authHeaders
					},
                credentials: 'include',
                body: JSON.stringify(oPayload)
            })
            .then(response => {
					console.log(`Response status for CREATE ${idx + 1}:`, response.status);
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
						return contentType && contentType.includes('application/json') ? response.json() : { success: true };
					}
                    return response.text().then(text => {
						throw new Error(`CREATE ${idx + 1} failed: HTTP ${response.status} - ${text}`);
                    });
            });
			});
			
			return Promise.all(aPromises);
        }
        ,
        _processUpdateRecords(sApiUrl, aUpdateData, oBtn) {
            
            
            const aHeaders = this._getAuthHeaders();
            
            // Gửi từng record với PATCH, chỉ sử dụng format đã hoạt động
            const aPromises = aUpdateData.map((item, index) => {
                // Xây dựng URL cho từng record cụ thể
                const sRecordUrl = this._buildRecordUrl(sApiUrl, item);
                
                // Loại bỏ __metadata và format date đúng cách
                const cleanData = { ...item.data };
                delete cleanData.__metadata;
                delete cleanData.__op;
                // Coerce per metadata first, then format for V2
                const coerced = Object.keys(cleanData).reduce((acc, k) => {
                    const coercedVal = this._coerceValuePerMetadata(this._oSmartTable, k, cleanData[k]);
                    if (coercedVal !== undefined) { acc[k] = coercedVal; }
                    return acc;
                }, {});
                // Format dates cho SAP OData V2
                const formattedData = this._formatDataForODataV2(coerced);
                
                // Use raw entity payload for UPDATE (no 'd' wrapper)
                const oPayload = formattedData;
                
                
                
                return fetch(sRecordUrl, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'If-Match': '*',
                        ...aHeaders
                    },
                    credentials: 'include',
                    body: JSON.stringify(oPayload)
                })
                .then(response => {
                    
                    
                    if (response.ok) {
                        
                        
                        // Kiểm tra xem response có JSON body không
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            return response.json();
                        } else {
                            // Nếu không có JSON body, trả về success message
                            
                            return { success: true, message: `Record ${index + 1} updated successfully` };
                        }
                    } else {
                        
                        return response.text().then(text => {
                            
                            throw new Error(`UPDATE record ${index + 1} failed: HTTP ${response.status} - ${text}`);
                        });
                    }
                })
                .catch(error => {
                    
                    throw error;
                });
            });

            return Promise.all(aPromises);
        }
        ,
        _buildRecordUrl(sBaseUrl, oItem) {
            try {
                const oData = oItem.data;
                const aKeyFields = this._getKeyPropertyNames(this._oSmartTable);
                
                
                
                if (aKeyFields && aKeyFields.length > 0) {
                    const aKeyParts = aKeyFields.map(key => {
                        const value = oData[key];
                        
                        
                        if (value === null || value === undefined) {
                            console.warn(`Key ${key} has null/undefined value, skipping`);
                            return null;
                        }
                        
                        // Format value according to OData V2 syntax
                        if (typeof value === 'string') {
                            // Escape single quotes in string values
                            const escapedValue = value.replace(/'/g, "''");
                            return `'${escapedValue}'`;
                        } else if (typeof value === 'number') {
                            return value.toString();
                        } else if (typeof value === 'boolean') {
                            return value.toString();
                        } else if (value instanceof Date) {
                            // Format date according to OData V2
                            return `datetime'${value.toISOString()}'`;
                        } else {
                            // Convert to string and escape
                            const strValue = String(value);
                            const escapedValue = strValue.replace(/'/g, "''");
                            return `'${escapedValue}'`;
                        }
                    }).filter(Boolean); // Remove null values
                    
                    if (aKeyParts.length > 0) {
                        // Format: http://localhost:52118/testclient/sap/opu/odata/sap/ZSB_U2_SE16N_01/ZDATASPHERE('100001')
                        const sRecordUrl = `${sBaseUrl}(${aKeyParts.join(',')})`;
                        
                        return sRecordUrl;
                    }
                }
                
                // Fallback: try to use path if available
                if (oItem.path && oItem.path !== '/' && oItem.path !== sBaseUrl) {
                    // Extract key from path like "/ZDATASPHERE('key1','key2')"
                    const pathMatch = oItem.path.match(/\(([^)]+)\)$/);
                    if (pathMatch) {
                        const sRecordUrl = `${sBaseUrl}(${pathMatch[1]})`;
                        
                        return sRecordUrl;
                    }
                }
                
                console.warn("Could not build record URL, using base URL");
                return sBaseUrl;
            } catch (error) {
                console.error("Error building record URL:", error);
                return sBaseUrl;
            }
        }
        ,
        _formatDataForODataV2(oData) {
            try {
                const formattedData = { ...oData };
                
                // Format dates và numbers cho SAP OData V2
                for (const key in formattedData) {
                    if (formattedData.hasOwnProperty(key)) {
                        const value = formattedData[key];
                        
                        // Nếu là Date object hoặc date string, convert sang SAP format
                        if (value instanceof Date || (typeof value === 'string' && this._isDateString(value))) {
                            formattedData[key] = this._formatDateForSAP(value);
                        }
                        // Nếu là number và có thể là date (timestamp), thử convert
                        else if (typeof value === 'number' && value > 1000000000000) {
                            formattedData[key] = this._formatDateForSAP(new Date(value));
                        }
                        // Nếu là string có thể là number (có dấu phẩy), format lại
                        else if (typeof value === 'string' && this._isNumericString(value)) {
                            formattedData[key] = this._formatNumericForSAP(value);
                        }
                        // Nếu là number, đảm bảo format đúng
                        else if (typeof value === 'number') {
                            formattedData[key] = this._formatNumericForSAP(value);
                        }
                    }
                }
                
                
                return formattedData;
            } catch (error) {
                console.error("Error formatting data for OData V2:", error);
                return oData;
            }
        }
        ,
        _isDateString(sValue) {
            try {
                // Kiểm tra xem string có phải là date không
                const date = new Date(sValue);
                return !isNaN(date.getTime()) && sValue.includes('-') && sValue.includes('T');
            } catch (e) {
                return false;
            }
        }
        ,
        _isNumericString(sValue) {
            try {
                // Kiểm tra xem string có phải là number có format không (có dấu phẩy, dấu chấm)
                if (typeof sValue !== 'string') return false;
                
                // Loại bỏ spaces và kiểm tra pattern
                const cleanValue = sValue.trim();
                
                // Pattern cho number: có thể có dấu phẩy, dấu chấm, số âm
                const numericPattern = /^-?[\d,]+\.?\d*$/;
                return numericPattern.test(cleanValue) && (cleanValue.includes(',') || cleanValue.includes('.'));
            } catch (e) {
                return false;
            }
        }
        ,
        _formatNumericForSAP(value) {
            try {
                let num;
                
                if (typeof value === 'number') {
                    num = value;
                } else if (typeof value === 'string') {
                    // Loại bỏ dấu phẩy và spaces, convert sang number
                    const cleanValue = value.replace(/,/g, '').replace(/\s/g, '');
                    num = parseFloat(cleanValue);
                } else {
                    return value;
                }
                
                if (isNaN(num)) {
                    return value;
                }
                
                // Trả về NUMBER để OData V2 nhận đúng type (Byte/Int/Decimal)
                
                return num;
            } catch (error) {
                console.error("Error formatting number for SAP:", error);
                return value;
            }
        }
        ,
        _formatDateForSAP(value) {
            try {
                let date;
                
                if (value instanceof Date) {
                    date = value;
                } else if (typeof value === 'string') {
                    date = new Date(value);
                } else if (typeof value === 'number') {
                    date = new Date(value);
                } else {
                    return value;
                }
                
                if (isNaN(date.getTime())) {
                    return value;
                }
                
                // Format cho SAP OData V2: /Date(timestamp)/
                const timestamp = date.getTime();
                const sapDate = `/Date(${timestamp})/`;
                
                
                return sapDate;
            } catch (error) {
                console.error("Error formatting date for SAP:", error);
                return value;
            }
        }
        ,
        _callApiPostWithAuth(sApiUrl, aData, oBtn) {
			// Lấy CSRF từ service root để đảm bảo tính nhất quán
			try {
				this._ensureCsrfToken()
					.then(() => this._callApiPost(sApiUrl, aData, oBtn))
					.catch(() => this._callApiPost(sApiUrl, aData, oBtn));
			} catch (error) {
				this._callApiPost(sApiUrl, aData, oBtn);
			}
        }
        ,
        _ensureCsrfToken() {
            return new Promise((resolve, reject) => {
                try {
                    const oModel = this.getView().getModel();
                    
                    if (oModel && oModel.getCsrfToken) {
                        const sExistingToken = oModel.getCsrfToken();
                        if (sExistingToken) {
                            resolve(sExistingToken);
                            return;
                        }
                    }
                    
                    const sServiceUrl = oModel.getServiceUrl?.() || oModel.sServiceUrl || "";
                    if (!sServiceUrl) {
                        reject(new Error("Service URL not found"));
                        return;
                    }
                    
					// Theo chuẩn SAP, lấy CSRF bằng GET với header Fetch từ service root
					fetch(sServiceUrl, {
						method: 'GET',
                        credentials: 'include',
                        headers: {
							'X-CSRF-Token': 'Fetch',
							'accept': 'application/json'
                        }
                    })
                    .then(response => {
                        const csrfToken = response.headers.get('X-CSRF-Token');
                        if (csrfToken) {
                            if (oModel && oModel.setCsrfToken) {
                                oModel.setCsrfToken(csrfToken);
                            }
                            resolve(csrfToken);
                        } else {
							resolve(null);
                        }
                    })
                    .catch(error => {
                        reject(error);
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }
		,
        
        _getAuthHeaders() {
            try {
                const oModel = this.getView().getModel();
                const aHeaders = {};
                
                if (oModel && oModel.getHeaders) {
                    const oModelHeaders = oModel.getHeaders();
                    if (oModelHeaders) {
                        Object.assign(aHeaders, oModelHeaders);
                        console.log("Model headers:", oModelHeaders);
                    }
                }
                
                if (oModel && oModel.getCsrfToken) {
                    const sCsrfToken = oModel.getCsrfToken();
                    if (sCsrfToken) {
                        aHeaders['X-CSRF-Token'] = sCsrfToken;
                    }
                }
                
                aHeaders['X-Requested-With'] = 'XMLHttpRequest';
                console.log("Final auth headers:", aHeaders);
                return aHeaders;
            } catch (error) {
                console.error("Error getting auth headers:", error);
                return {
                    'X-Requested-With': 'XMLHttpRequest'
                };
            }
        }
        ,
        _getDraftItems() {
            try {
                const aDrafts = this._oDraftModel?.getProperty?.("/drafts") || [];
                if (!aDrafts.length) { return []; }
                const mProps = this._getEntityPropertyMap(this._oSmartTable);
                const sEntitySet = this._oSmartTable?.getEntitySet?.();
                return aDrafts.map(d => {
                    const data = { ...d };
                    delete data.__isDraft; delete data.__id;
                    if (!data.__op) { data.__op = "create"; }
                    const normalized = {};
                    Object.keys(data).forEach((k) => {
                        const v = data[k];
                        if (v === undefined) { return; }
                        normalized[k] = this._normalizeValueForEdmType(this._oSmartTable, `/${k}`, v);
                    });
                    return { context: null, data: normalized, path: `/${sEntitySet}`, isNew: true, hasChanges: true };
                });
            } catch (e) { return []; }
        }
    });
});


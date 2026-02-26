sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/date/UI5Date",
    "sap/ui/core/Popup"
], function(Controller, MessageToast, MessageBox, JSONModel, UI5Date, Popup) {
    "use strict";

    return Controller.extend("demoextend.ext.view.Wizard", {
        
        // Helper method to show MessageToast with proper positioning
        _showMessageToast: function(sMessage, oOptions) {
            // Default options for MessageToast
            var oToastOptions = oOptions || {};
            
            // If positioning is specified, ensure it uses proper Popup.Dock values
            if (oToastOptions.my || oToastOptions.at) {
                // Convert string values to proper Popup.Dock enumeration values
                if (typeof oToastOptions.my === "string") {
                    oToastOptions.my = this._convertToDockValue(oToastOptions.my);
                }
                if (typeof oToastOptions.at === "string") {
                    oToastOptions.at = this._convertToDockValue(oToastOptions.at);
                }
            }
            
            MessageToast.show(sMessage, oToastOptions);
        },
        
        // Helper method to convert string positioning to Popup.Dock values
        _convertToDockValue: function(sPosition) {
            var sDockValue;
            switch (sPosition.toLowerCase()) {
                case "center bottom":
                    sDockValue = Popup.Dock.CenterBottom;
                    break;
                case "center center":
                    sDockValue = Popup.Dock.CenterCenter;
                    break;
                case "center top":
                    sDockValue = Popup.Dock.CenterTop;
                    break;
                case "left bottom":
                    sDockValue = Popup.Dock.LeftBottom;
                    break;
                case "left center":
                    sDockValue = Popup.Dock.LeftCenter;
                    break;
                case "left top":
                    sDockValue = Popup.Dock.LeftTop;
                    break;
                case "right bottom":
                    sDockValue = Popup.Dock.RightBottom;
                    break;
                case "right center":
                    sDockValue = Popup.Dock.RightCenter;
                    break;
                case "right top":
                    sDockValue = Popup.Dock.RightTop;
                    break;
                default:
                    // Default to center bottom if invalid value
                    sDockValue = Popup.Dock.CenterBottom;
                    break;
            }
            return sDockValue;
        },
        
        onInit: function() {
            // Initialize JSON model for products
            var oProductModel = new JSONModel({
                Products: []
            });
            this.getView().setModel(oProductModel);
            
            // Initialize product table model with sample data
            this._initializeProductModel();
            
            // Initialize sales order table model with sample data
            this._initializeSalesOrderModel();
            
            // Initialize toolbar buttons
            this._updateToolbarButtons();
            
            // Get wizard control
            this._oWizard = this.byId("CreateDeliveryWizard");
            
            // Initialize step validation
            this._bStep1Valid = false;
            this._bStep2Valid = false;
            this._bStep3Valid = false;
            
            // Initialize dialog tracking
            this._oCurrentEditDialog = null;
            
            // Update button states
            this._updateButtonStates();
        },
        
        onAfterRendering: function() {
            // Set initial button states
            this._updateButtonStates();
            
            // Initialize table after rendering with a delay
            setTimeout(function() {
                this._initializeSmartTable();
                // Ensure data consistency after table initialization
                this._ensureDataConsistency();
            }.bind(this), 500);
        },
        
        // Navigation methods
        onNextStep: function() {
            var iCurrentStep = this._oWizard ? this._oWizard.getProgress() : 0;
            
            if (this._validateCurrentStep(iCurrentStep)) {
                this._oWizard.nextStep();
                this._updateButtonStates();
            }
        },
        
        onPreviousStep: function() {
            if (this._oWizard) {
                this._oWizard.previousStep();
                this._updateButtonStates();
            }
        },
        
        onNavBack: function() {
            // Navigate back to list page
            if (this.routing && this.routing.navigateToRoute) {
                this.routing.navigateToRoute("headerList");
            }
        },
        
        // Step validation methods
        _validateCurrentStep: function(iStep) {
            switch(iStep) {
                case 0: // Step 1
                    return this._validateStep1();
                case 1: // Step 2
                    return this._validateStep2();
                case 2: // Step 3
                    return this._validateStep3();
                default:
                    return true;
            }
        },
        
        _validateStep1: function() {
            // For step 1, we just need to ensure the smart table has data
            // The smart table handles its own validation
            this._bStep1Valid = true;
            this._updateSummary();
            return true;
        },
        
        _validateStep2: function() {
            var oDeliveryId = this.byId("deliveryId");
            var oCustomerName = this.byId("customerName");
            var oDeliveryDate = this.byId("deliveryDate");
            
            var bValid = true;
            var sErrorMessage = "";
            
            // Validate Delivery ID
            if (oDeliveryId && !oDeliveryId.getValue()) {
                oDeliveryId.setValueState("Error");
                sErrorMessage += "Delivery ID is required.\n";
                bValid = false;
            } else if (oDeliveryId) {
                oDeliveryId.setValueState("None");
            }
            
            // Validate Customer Name
            if (oCustomerName && !oCustomerName.getValue()) {
                oCustomerName.setValueState("Error");
                sErrorMessage += "Customer Name is required.\n";
                bValid = false;
            } else if (oCustomerName) {
                oCustomerName.setValueState("None");
            }
            
            // Validate Delivery Date
            if (oDeliveryDate && !oDeliveryDate.getValue()) {
                oDeliveryDate.setValueState("Error");
                sErrorMessage += "Delivery Date is required.\n";
                bValid = false;
            } else if (oDeliveryDate) {
                oDeliveryDate.setValueState("None");
            }
            
            if (!bValid) {
                MessageBox.error(sErrorMessage, {
                    title: "Validation Error"
                });
            } else {
                this._bStep2Valid = true;
                this._updateSummary();
            }
            
            return bValid;
        },
        
        _validateStep3: function() {
            this._bStep3Valid = true;
            this._updateSummary();
            return true;
        },
        
        // Table initialization and management
        _initializeSmartTable: function() {
            try {
                // Initialize table - no refresh needed as data is in JSON model
                var oTable = this.byId("productTable");
                console.log("Initializing table with existing JSON model data");
                
                // Set step 1 as valid
                this._bStep1Valid = true;
                this._updateSummary();
                
                // Debug table status
                this._debugTableStatus();
                
                this._showMessageToast("Table refreshed successfully");
                
            } catch (error) {
                console.error("Error refreshing table:", error);
                this._showMessageToast("Error refreshing table");
            }
        },
        
        onAddNewProduct: function() {
            this.createNewProduct();
        },
        
        // Initialize product model with sample data
        _initializeProductModel: function() {
            var oNow = new Date();
            var aSampleData = [
                {
                    Keyid: this._generateKeyId(),
                    SalesOrganization: "1000",
                    DistributionChannel: "10",
                    OrganizationDivision: "00",
                    SoldToParty: "CUST001",
                    Product: "MAT001",
                    Quantity: 10.500,
                    Unit: "KG",
                    LocalCreatedBy: "USER",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "USER",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                },
                {
                    Keyid: this._generateKeyId(),
                    SalesOrganization: "2000",
                    DistributionChannel: "20",
                    OrganizationDivision: "01",
                    SoldToParty: "CUST002",
                    Product: "MAT002",
                    Quantity: 25.000,
                    Unit: "PCS",
                    LocalCreatedBy: "USER",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "USER",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                },
                {
                    Keyid: this._generateKeyId(),
                    SalesOrganization: "3000",
                    DistributionChannel: "30",
                    OrganizationDivision: "02",
                    SoldToParty: "CUST003",
                    Product: "MAT003",
                    Quantity: 5.250,
                    Unit: "L",
                    LocalCreatedBy: "USER",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "USER",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                }
            ];
            
            var oTableModel = new JSONModel({
                results: aSampleData
            });
            
            this.getView().setModel(oTableModel, "productModel");
        },
        
        _generateKeyId: function() {
            // Generate a unique UUID v4 for new products
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0;
                var v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        
        // Debug method to check table status
        _debugTableStatus: function() {
            var oTable = this.byId("productTable");
            var oModel = this.getView().getModel("productModel");
            
            console.log("=== DEBUG TABLE STATUS ===");
            console.log("Table:", oTable);
            console.log("Model:", oModel);
            
            if (oModel) {
                var aResults = oModel.getProperty("/results");
                console.log("Results:", aResults);
                console.log("Results length:", aResults ? aResults.length : 0);
                
                if (aResults && aResults.length > 0) {
                    console.log("First item:", aResults[0]);
                    console.log("Last item:", aResults[aResults.length - 1]);
                    
                    // Check if all required properties exist
                    var oFirstItem = aResults[0];
                    console.log("First item properties:");
                    console.log("- Product:", oFirstItem.Product);
                    console.log("- Quantity:", oFirstItem.Quantity);
                    console.log("- Unit:", oFirstItem.Unit);
                    console.log("- LocalCreatedBy:", oFirstItem.LocalCreatedBy);
                    console.log("- LocalCreatedAt:", oFirstItem.LocalCreatedAt);
                    console.log("- LocalLastChangedBy:", oFirstItem.LocalLastChangedBy);
                    console.log("- LocalLastChangedAt:", oFirstItem.LocalLastChangedAt);
                }
            }
            
            if (oTable) {
                var oBinding = oTable.getBinding("rows");
                console.log("Binding:", oBinding);
                if (oBinding) {
                    console.log("Binding length:", oBinding.getLength());
                    console.log("Binding path:", oBinding.getPath());
                    console.log("Binding model:", oBinding.getModel());
                    
                    // Check if binding has data
                    if (oBinding.getLength() > 0) {
                        var oContext = oBinding.getContexts()[0];
                        if (oContext) {
                            console.log("First binding context:", oContext.getObject());
                        }
                    }
                }
            }
            
            console.log("=== END DEBUG ===");
        },
        
        // Method to create new product in table
        createNewProduct: function() {
            var oProductModel = this.getView().getModel("productModel");
            if (oProductModel) {
                var aResults = oProductModel.getProperty("/results") || [];
                var oNow = new Date();
                var oNewProduct = {
                    Keyid: this._generateKeyId(),
                    SalesOrganization: "",
                    DistributionChannel: "",
                    OrganizationDivision: "",
                    SoldToParty: "",
                    Product: "",
                    Quantity: 0,
                    Unit: "",
                    LocalCreatedBy: "USER",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "USER",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                };
                
                aResults.push(oNewProduct);
                oProductModel.setProperty("/results", aResults);
                
                this._showMessageToast("New product row created. Please fill in the details.");
            }
        },
        
        // Initialize sales order model with sample data
        _initializeSalesOrderModel: function() {
            var oNow = new Date();
            var aSampleData = [
                {
                    Keyid: this._generateKeyId(),
                    SalesOrder: "SO001",
                    SalesOrderItem: "10",
                    Product: "MAT001",
                    Quantity: 15.500,
                    Unit: "KG",
                    LocalCreatedBy: "USER",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "USER",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                },
                {
                    Keyid: this._generateKeyId(),
                    SalesOrder: "SO002",
                    SalesOrderItem: "20",
                    Product: "MAT002",
                    Quantity: 30.000,
                    Unit: "PCS",
                    LocalCreatedBy: "USER",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "USER",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                },
                {
                    Keyid: this._generateKeyId(),
                    SalesOrder: "SO003",
                    SalesOrderItem: "30",
                    Product: "MAT003",
                    Quantity: 8.750,
                    Unit: "L",
                    LocalCreatedBy: "USER",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "USER",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                }
            ];
            
            var oTableModel = new JSONModel({
                results: aSampleData
            });
            
            this.getView().setModel(oTableModel, "salesOrderModel");
        },
        
        // Handle table selection change (built-in selection)
        onTableSelectionChange: function(oEvent) {
            var oTable = this.byId("productTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            var oModel = this.getView().getModel("productModel");
            var aResults = oModel.getProperty("/results") || [];
            
            console.log("Table built-in selection changed. Selected indices:", aSelectedIndices);
            
            // Clear all checkbox selection flags
            aResults.forEach(function(oProduct) {
                oProduct.selected = false;
            });
            
            // Set checkbox selection flags based on table selection
            aSelectedIndices.forEach(function(iIndex) {
                if (aResults[iIndex]) {
                    aResults[iIndex].selected = true;
                }
            });
            
            // Update model
            oModel.setProperty("/results", aResults);
            
            // Update toolbar buttons
            this._updateToolbarButtons();
        },
        
        // Handle checkbox selection change
        onCheckboxSelectionChange: function(oEvent) {
            var oCheckBox = oEvent.getSource();
            var bSelected = oCheckBox.getSelected();
            var oBindingContext = oCheckBox.getBindingContext("productModel");
            
            if (oBindingContext) {
                var sPath = oBindingContext.getPath();
                var oModel = this.getView().getModel("productModel");
                
                console.log("Checkbox selection changed. Path:", sPath, "Selected:", bSelected);
                
                // Update the selected property in the model
                oModel.setProperty(sPath + "/selected", bSelected);
                
                // Clear table built-in selection to avoid conflicts
                var oTable = this.byId("productTable");
                if (oTable) {
                    oTable.clearSelection();
                }
                
                // Update toolbar buttons
                this._updateToolbarButtons();
            }
        },
        
        // Helper method to get selected products from both checkbox and table selection
        _getSelectedProducts: function() {
            var oModel = this.getView().getModel("productModel");
            var aResults = oModel.getProperty("/results") || [];
            var aSelectedProducts = [];
            
            console.log("=== GETTING SELECTED PRODUCTS ===");
            console.log("Total products in model:", aResults.length);
            
            // Method 1: Check for checkbox-selected products (selected property in model)
            aResults.forEach(function(oProduct, iIndex) {
                console.log("Product " + iIndex + " selected state:", oProduct.selected, "Keyid:", oProduct.Keyid);
                if (oProduct.selected === true) {
                    aSelectedProducts.push(oProduct);
                    console.log("Added checkbox-selected product:", oProduct.Keyid);
                }
            });
            
            console.log("Checkbox-selected products count:", aSelectedProducts.length);
            
            // Method 2: If no checkbox selections, check table built-in selection
            if (aSelectedProducts.length === 0) {
            var oTable = this.byId("productTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            
                console.log("Table selected indices:", aSelectedIndices);
                
                aSelectedIndices.forEach(function(iIndex) {
                    if (aResults[iIndex]) {
                        aSelectedProducts.push(aResults[iIndex]);
                        console.log("Added table-selected product at index " + iIndex + ":", aResults[iIndex].Keyid);
                    }
                });
            }
            
            console.log("Final selected products:", aSelectedProducts.map(function(p) { return p.Keyid; }));
            console.log("Selection method used:", aSelectedProducts.length > 0 ? 
                (aResults.some(function(p) { return p.selected; }) ? "Checkbox" : "Table") : "None");
            console.log("=== END GETTING SELECTED PRODUCTS ===");
            
            return aSelectedProducts;
        },
        
        // Edit selected product method
        onEditSelected: function() {
            var aSelectedProducts = this._getSelectedProducts();
            
            if (aSelectedProducts.length === 0) {
                this._showMessageToast("Please select a product to edit");
                return;
            }
            
            if (aSelectedProducts.length > 1) {
                this._showMessageToast("Please select only one product to edit");
                return;
            }
            
            var oProduct = aSelectedProducts[0];
            
            if (oProduct) {
                console.log("Editing selected product:", oProduct);
                // Show edit dialog
                this._showEditDialog(oProduct);
            } else {
                this._showMessageToast("Selected product not found");
            }
        },
        
        // Delete selected products method
        onDeleteSelected: function() {
            var aSelectedProducts = this._getSelectedProducts();
            
            if (aSelectedProducts.length === 0) {
                this._showMessageToast("Please select products to delete");
                return;
            }
            
            console.log("=== DELETE SELECTED INITIATED ===");
            console.log("Selected products to delete:", aSelectedProducts.length);
            
            var sMessage = aSelectedProducts.length === 1 
                ? "Are you sure you want to delete this product?" 
                : "Are you sure you want to delete " + aSelectedProducts.length + " products?";
            
            // Show confirmation dialog
            MessageBox.confirm(sMessage, {
                title: "Confirm Delete",
                onClose: function(sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._deleteSelectedProducts(aSelectedProducts);
                    }
                }.bind(this)
            });
        },
        
        // Update toolbar buttons based on selection
        _updateToolbarButtons: function() {
            var aSelectedProducts = this._getSelectedProducts();
            var iSelectedCount = aSelectedProducts.length;
            
            var oEditButton = this.byId("editSelectedButton");
            var oDeleteButton = this.byId("deleteSelectedButton");
            
            if (oEditButton) {
                oEditButton.setEnabled(iSelectedCount === 1);
            }
            
            if (oDeleteButton) {
                oDeleteButton.setEnabled(iSelectedCount > 0);
            }
        },
        
        // Show edit dialog
        _showEditDialog: function(oProduct) {
            // Close any existing dialog first
            if (this._oCurrentEditDialog) {
                this._oCurrentEditDialog.close();
                this._oCurrentEditDialog = null;
            }
            
            // Generate unique IDs for this dialog instance
            var sDialogId = "editDialog_" + Date.now();
            var sSalesOrgId = sDialogId + "_salesOrg";
            var sDistChannelId = sDialogId + "_distChannel";
            var sOrgDivisionId = sDialogId + "_orgDivision";
            var sSoldToPartyId = sDialogId + "_soldToParty";
            var sProductId = sDialogId + "_product";
            var sQuantityId = sDialogId + "_quantity";
            var sUnitId = sDialogId + "_unit";
            
            // Create input fields with unique IDs
            var oSalesOrgInput = new sap.m.Input({ 
                value: oProduct.SalesOrganization, 
                id: sSalesOrgId 
            });
            var oDistChannelInput = new sap.m.Input({ 
                value: oProduct.DistributionChannel, 
                id: sDistChannelId 
            });
            var oOrgDivisionInput = new sap.m.Input({ 
                value: oProduct.OrganizationDivision, 
                id: sOrgDivisionId 
            });
            var oSoldToPartyInput = new sap.m.Input({ 
                value: oProduct.SoldToParty, 
                id: sSoldToPartyId 
            });
            var oProductInput = new sap.m.Input({ 
                value: oProduct.Product, 
                id: sProductId 
            });
            var oQuantityInput = new sap.m.Input({ 
                value: oProduct.Quantity, 
                id: sQuantityId, 
                type: "Number" 
            });
            var oUnitInput = new sap.m.Input({ 
                value: oProduct.Unit, 
                id: sUnitId 
            });
            
            // Create a simple form dialog for editing
            var oDialog = new sap.m.Dialog({
                id: sDialogId,
                title: "Edit Product",
                contentWidth: "500px",
                content: [
                    new sap.ui.layout.form.SimpleForm({
                        content: [
                            new sap.ui.core.Title({ text: "Product Information" }),
                            new sap.m.Label({ text: "Sales Organization" }),
                            oSalesOrgInput,
                            new sap.m.Label({ text: "Distribution Channel" }),
                            oDistChannelInput,
                            new sap.m.Label({ text: "Organization Division" }),
                            oOrgDivisionInput,
                            new sap.m.Label({ text: "Sold To Party" }),
                            oSoldToPartyInput,
                            new sap.m.Label({ text: "Product" }),
                            oProductInput,
                            new sap.m.Label({ text: "Quantity" }),
                            oQuantityInput,
                            new sap.m.Label({ text: "Unit" }),
                            oUnitInput
                        ]
                    })
                ],
                buttons: [
                    new sap.m.Button({
                        text: "Save",
                        type: "Emphasized",
                        press: function() {
                            this._saveEditedProduct(oProduct, {
                                salesOrg: oSalesOrgInput,
                                distChannel: oDistChannelInput,
                                orgDivision: oOrgDivisionInput,
                                soldToParty: oSoldToPartyInput,
                                product: oProductInput,
                                quantity: oQuantityInput,
                                unit: oUnitInput
                            });
                            oDialog.close();
                        }.bind(this)
                    }),
                    new sap.m.Button({
                        text: "Cancel",
                        press: function() {
                            oDialog.close();
                        }
                    })
                ],
                afterClose: function() {
                    // Clean up dialog and its content
                    oDialog.destroy();
                    // Clear current dialog reference
                    if (this._oCurrentEditDialog === oDialog) {
                        this._oCurrentEditDialog = null;
                    }
                }.bind(this)
            });
            
            // Store reference to current dialog
            this._oCurrentEditDialog = oDialog;
            
            oDialog.open();
        },
        
        // Save edited product
        _saveEditedProduct: function(oProduct, oInputFields) {
            var oModel = this.getView().getModel("productModel");
            var aResults = oModel.getProperty("/results");
            
            console.log("=== SAVING EDITED PRODUCT ===");
            console.log("Original product:", oProduct);
            console.log("Input fields:", oInputFields);
            
            // Find and update the product by Keyid
            var bProductFound = false;
            for (var i = 0; i < aResults.length; i++) {
                if (aResults[i].Keyid === oProduct.Keyid) {
                    console.log("Found product at index:", i);
                    
                    // Update all required properties
                    aResults[i].SalesOrganization = oInputFields.salesOrg.getValue();
                    aResults[i].DistributionChannel = oInputFields.distChannel.getValue();
                    aResults[i].OrganizationDivision = oInputFields.orgDivision.getValue();
                    aResults[i].SoldToParty = oInputFields.soldToParty.getValue();
                    aResults[i].Product = oInputFields.product.getValue();
                    aResults[i].Quantity = parseFloat(oInputFields.quantity.getValue()) || 0;
                    aResults[i].Unit = oInputFields.unit.getValue();
                    aResults[i].LocalLastChangedBy = "USER";
                    aResults[i].LocalLastChangedAt = new Date().toISOString();
                    aResults[i].LastChangedAt = new Date().toISOString();
                    
                    console.log("Updated product:", aResults[i]);
                    bProductFound = true;
                    break;
                }
            }
            
            if (!bProductFound) {
                console.error("Product not found for Keyid:", oProduct.Keyid);
                MessageBox.error("Product not found for editing. Please try again.", {
                    title: "Edit Error"
                });
                return;
            }
            
            // Update model with new data
            oModel.setProperty("/results", aResults);
            
            // Refresh table binding (same as reference code)
            var oTable = this.byId("productTable");
            if (oTable) {
                var oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.refresh();
                    console.log("Table binding refreshed");
                }
            }
            
            // Clear table selection and update toolbar
            if (oTable) {
                oTable.clearSelection();
            }
            this._updateToolbarButtons();
            
            // Verify data update
            setTimeout(function() {
                this._verifyDataUpdate(oProduct.Keyid);
            }.bind(this), 100);
            
            this._showMessageToast("Product updated successfully");
        },
        
        // Delete selected products - Fixed to match reference code
        _deleteSelectedProducts: function(aSelectedProducts) {
            var oModel = this.getView().getModel("productModel");
            var aResults = oModel.getProperty("/results");
            
            console.log("=== DELETING SELECTED PRODUCTS ===");
            console.log("Products to delete:", aSelectedProducts);
            console.log("Original results count:", aResults.length);
            
            // Use the same logic as reference code - nested loops with splice
            for (var i = aResults.length - 1; i >= 0; i--) {
                for (var j = 0; j < aSelectedProducts.length; j++) {
                    if (aResults[i].Keyid === aSelectedProducts[j].Keyid) {
                        console.log("Removing product:", aResults[i]);
                        aResults.splice(i, 1);
                        break;
                    }
                }
            }
            
            console.log("Results count after deletion:", aResults.length);
            
            // Update model with modified array (same as reference code)
            oModel.setProperty("/results", aResults);
            
            // Refresh table using items binding (same as reference code)
            var oTable = this.byId("productTable");
            if (oTable) {
                var oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.refresh();
                    console.log("Table binding refreshed after deletion");
                }
            }
            
            // Clear table selection and update toolbar buttons
            if (oTable) {
                oTable.clearSelection();
            }
            this._updateToolbarButtons();
            
            var sMessage = aSelectedProducts.length === 1 
                ? "Product deleted successfully" 
                : aSelectedProducts.length + " products deleted successfully";
            this._showMessageToast(sMessage);
            
            console.log("=== DELETION COMPLETED ===");
        },
        
        // Summary update method
        _updateSummary: function() {
            if (this._bStep1Valid) {
                // For step 1, we'll show product count from table
                var oProductModel = this.getView().getModel("productModel");
                if (oProductModel) {
                    var aResults = oProductModel.getProperty("/results");
                    if (aResults) {
                        var iProductCount = aResults.length;
                        var oSummaryElement = this.byId("summaryTotalProducts");
                        if (oSummaryElement) {
                            oSummaryElement.setText(iProductCount.toString() + " products");
                        }
                    }
                }
            }
            
            if (this._bStep2Valid) {
                var oDeliveryId = this.byId("deliveryId");
                var oCustomerName = this.byId("customerName");
                var oDeliveryDate = this.byId("deliveryDate");
                var oPriority = this.byId("priority");
                
                if (oDeliveryId && oCustomerName && oDeliveryDate && oPriority) {
                    // Update summary with delivery information
                    var oSummaryDeliveryId = this.byId("summaryDeliveryId");
                    var oSummaryCustomerName = this.byId("summaryCustomerName");
                    var oSummaryDeliveryDate = this.byId("summaryDeliveryDate");
                    var oSummaryPriority = this.byId("summaryPriority");
                    
                    if (oSummaryDeliveryId) oSummaryDeliveryId.setText(oDeliveryId.getValue());
                    if (oSummaryCustomerName) oSummaryCustomerName.setText(oCustomerName.getValue());
                    if (oSummaryDeliveryDate) oSummaryDeliveryDate.setText(oDeliveryDate.getValue());
                    if (oSummaryPriority) oSummaryPriority.setText(oPriority.getSelectedItem().getText());
                }
            }
            
            // Update sales order count if available
            var oSalesOrderModel = this.getView().getModel("salesOrderModel");
            if (oSalesOrderModel) {
                var aSalesOrders = oSalesOrderModel.getProperty("/results") || [];
                var oSummaryTotalSalesOrders = this.byId("summaryTotalSalesOrders");
                if (oSummaryTotalSalesOrders) {
                    oSummaryTotalSalesOrders.setText(aSalesOrders.length.toString() + " sales orders");
                }
                console.log("Sales orders count:", aSalesOrders.length);
            }
        },
        
        // Button state management
        _updateButtonStates: function() {
            var iCurrentStep = this._oWizard ? this._oWizard.getProgress() : 0;
            var oPreviousButton = this.byId("previousButton");
            var oNextButton = this.byId("nextButton");
            var oCreateButton = this.byId("createButton");
            
            if (oPreviousButton) {
                oPreviousButton.setVisible(iCurrentStep > 0);
            }
            
            if (oNextButton && oCreateButton) {
                // Show/hide Next and Create buttons
                if (iCurrentStep === 2) {
                    oNextButton.setVisible(false);
                    oCreateButton.setVisible(true);
                } else {
                    oNextButton.setVisible(true);
                    oCreateButton.setVisible(false);
                }
                
                // Enable/disable Next button based on validation
                if (iCurrentStep === 0) {
                    oNextButton.setEnabled(this._bStep1Valid);
                } else if (iCurrentStep === 1) {
                    oNextButton.setEnabled(this._bStep2Valid);
                }
            }
        },
        
        // Create delivery method
        onCreateDelivery: function() {
            if (!this._bStep1Valid || !this._bStep2Valid) {
                MessageBox.error("Please complete all previous steps before creating the delivery.", {
                    title: "Validation Error"
                });
                return;
            }
            
            // Collect delivery data
            var oDeliveryData = {
                deliveryId: this.byId("deliveryId") ? this.byId("deliveryId").getValue() : "",
                customerName: this.byId("customerName") ? this.byId("customerName").getValue() : "",
                deliveryDate: this.byId("deliveryDate") ? this.byId("deliveryDate").getValue() : "",
                priority: this.byId("priority") ? this.byId("priority").getSelectedKey() : ""
            };
            
            // Show confirmation dialog
            MessageBox.confirm("Are you sure you want to create this delivery?", {
                title: "Confirm Delivery Creation",
                onClose: function(sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._createDelivery(oDeliveryData);
                    }
                }.bind(this)
            });
        },
        
        _createDelivery: function(oDeliveryData) {
            // Here you would typically call your OData service to create the delivery
            // For now, we'll just show a success message
            
            this._showMessageToast("Delivery created successfully!");
            
            // Navigate back to list page
            setTimeout(function() {
                if (this.routing && this.routing.navigateToRoute) {
                    this.routing.navigateToRoute("headerList");
                }
            }.bind(this), 1500);
        },
        
        // Helper method to ensure data consistency
        _ensureDataConsistency: function() {
            var oModel = this.getView().getModel("productModel");
            var oTable = this.byId("productTable");
            
            if (oModel && oTable) {
                var aResults = oModel.getProperty("/results") || [];
                var oBinding = oTable.getBinding("items");
                
                console.log("=== DATA CONSISTENCY CHECK ===");
                console.log("Model results count:", aResults.length);
                console.log("Table binding count:", oBinding ? oBinding.getLength() : "No binding");
                
                // Check if binding exists and has correct path
                if (!oBinding) {
                    console.log("Creating new binding for table");
                    oTable.bindItems({
                        path: "productModel>/results"
                    });
                } else if (oBinding.getPath() !== "/results") {
                    console.log("Fixing binding path");
                    oTable.unbindItems();
                    oTable.bindItems({
                        path: "productModel>/results"
                    });
                }
                
                // Force refresh if counts don't match (same as reference code)
                if (oBinding && oBinding.getLength() !== aResults.length) {
                    console.log("Count mismatch detected, refreshing binding");
                    oBinding.refresh();
                }
                
                console.log("=== CONSISTENCY CHECK COMPLETED ===");
            }
        },
        
        // Verify that data was updated correctly
        _verifyDataUpdate: function(sKeyId) {
            var oModel = this.getView().getModel("productModel");
            var aResults = oModel.getProperty("/results");
            
            console.log("=== VERIFY DATA UPDATE ===");
            console.log("Looking for KeyId:", sKeyId);
            
            var oUpdatedProduct = null;
            for (var i = 0; i < aResults.length; i++) {
                if (aResults[i].Keyid === sKeyId) {
                    oUpdatedProduct = aResults[i];
                    break;
                }
            }
            
            if (oUpdatedProduct) {
                console.log("Updated product found:", oUpdatedProduct);
                console.log("SalesOrganization:", oUpdatedProduct.SalesOrganization);
                console.log("Product:", oUpdatedProduct.Product);
                console.log("Quantity:", oUpdatedProduct.Quantity);
                console.log("Unit:", oUpdatedProduct.Unit);
            } else {
                console.error("Updated product not found!");
            }
        },
        
        // Check and fix binding method
        _checkAndFixBinding: function() {
            console.log("=== CHECKING AND FIXING BINDING ===");
            this._ensureDataConsistency();
            this._debugTableStatus();
            this._showMessageToast("Binding check completed");
        },
        
        // Force update table method - Fixed to match reference code
        _forceUpdateTable: function() {
            var oTable = this.byId("productTable");
            var oModel = this.getView().getModel("productModel");
            
            console.log("=== FORCE UPDATE TABLE ===");
            console.log("Table:", oTable);
            console.log("Model:", oModel);
            
            if (oTable && oModel) {
                var aResults = oModel.getProperty("/results") || [];
                console.log("Results to display:", aResults);
                console.log("Results length:", aResults.length);
                
                // Check current binding
                var oCurrentBinding = oTable.getBinding("items");
                console.log("Current binding:", oCurrentBinding);
                
                if (oCurrentBinding) {
                    console.log("Current binding path:", oCurrentBinding.getPath());
                    console.log("Current binding length:", oCurrentBinding.getLength());
                }
                
                // Try to refresh binding first
                if (oCurrentBinding) {
                    oCurrentBinding.refresh();
                    console.log("Binding refreshed");
                }
                
                // If binding refresh doesn't work, force model refresh
                setTimeout(function() {
                    var oNewBinding = oTable.getBinding("items");
                    if (oNewBinding && oNewBinding.getLength() !== aResults.length) {
                        console.log("Binding refresh didn't work, forcing model refresh...");
                        
                        // Force model refresh
                        oModel.setProperty("/results", aResults);
                        
                        this._showMessageToast("Table force updated with " + aResults.length + " items");
                    } else {
                        console.log("Binding refresh worked, items count:", oNewBinding.getLength());
                        this._showMessageToast("Table updated successfully with " + aResults.length + " items");
                    }
                }.bind(this), 100);
                
            } else {
                console.error("Table or model not found");
                this._showMessageToast("Error: Table or model not found");
            }
            
            console.log("=== END FORCE UPDATE ===");
        },
        
        // Test import method
        _testImport: function() {
            console.log("=== TESTING IMPORT ===");
            
            var oModel = this.getView().getModel("productModel");
            var aCurrentResults = oModel.getProperty("/results") || [];
            
            // Create test import data
            var oNow = new Date();
            var aTestImportData = [
                {
                    Keyid: this._generateKeyId(),
                    SalesOrganization: "TEST001",
                    DistributionChannel: "99",
                    OrganizationDivision: "99",
                    SoldToParty: "TESTCUST001",
                    Product: "IMPORTED_PRODUCT_001",
                    Quantity: 50.000,
                    Unit: "EA",
                    LocalCreatedBy: "IMPORT_TEST",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "IMPORT_TEST",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                },
                {
                    Keyid: this._generateKeyId(),
                    SalesOrganization: "TEST002",
                    DistributionChannel: "98",
                    OrganizationDivision: "98",
                    SoldToParty: "TESTCUST002",
                    Product: "IMPORTED_PRODUCT_002",
                    Quantity: 25.500,
                    Unit: "KG",
                    LocalCreatedBy: "IMPORT_TEST",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "IMPORT_TEST",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                },
                {
                    Keyid: this._generateKeyId(),
                    SalesOrganization: "TEST003",
                    DistributionChannel: "97",
                    OrganizationDivision: "97",
                    SoldToParty: "TESTCUST003",
                    Product: "IMPORTED_PRODUCT_003",
                    Quantity: 100.000,
                    Unit: "L",
                    LocalCreatedBy: "IMPORT_TEST",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "IMPORT_TEST",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString()
                }
            ];
            
            console.log("Current data count:", aCurrentResults.length);
            console.log("Test import data:", aTestImportData);
            
            // Merge test data with existing data
            var aCombinedResults = aCurrentResults.concat(aTestImportData);
            
            // Update model
            oModel.setProperty("/results", aCombinedResults);
            
            console.log("Data count after test import:", aCombinedResults.length);
            console.log("=== IMPORT TEST COMPLETED ===");
            
            // Show success message
            this._showMessageToast("Test import completed! Added " + aTestImportData.length + " test products to the table.");
            
            // Update toolbar buttons and summary
            this._updateToolbarButtons();
            this._updateSummary();
        },
        
        // Cancel button handler
        onCancel: function() {
            // Navigate back to list page
            if (this.routing && this.routing.navigateToRoute) {
                this.routing.navigateToRoute("headerList");
            }
        },
        
        // Complete button handler
        onComplete: function() {
            // This would typically complete the wizard process
            this._showMessageToast("Wizard completed successfully!");
            
            // Navigate back to list page
            setTimeout(function() {
                if (this.routing && this.routing.navigateToRoute) {
                    this.routing.navigateToRoute("headerList");
                }
            }.bind(this), 1500);
        },
        
        // Wizard complete handler
        onWizardComplete: function() {
            // This is called when the wizard is completed
            this._showMessageToast("Wizard completed successfully!");
            
            // Navigate back to list page
            setTimeout(function() {
                if (this.routing && this.routing.navigateToRoute) {
                    this.routing.navigateToRoute("headerList");
                }
            }.bind(this), 1500);
        },
        
        // Import file handler
        onImportFile: function() {
            console.log("=== IMPORTING FILE ===");
            
            // Create a file input element dynamically
            var oFileInput = document.createElement("input");
            oFileInput.type = "file";
            oFileInput.accept = ".csv,.xlsx,.json";
            oFileInput.style.display = "none";
            
            // Add event listener for file selection
            oFileInput.addEventListener("change", function(oEvent) {
                var oFile = oEvent.target.files[0];
                if (oFile) {
                    console.log("Selected file:", oFile.name, "Type:", oFile.type, "Size:", oFile.size);
                    this._processImportFile(oFile);
                } else {
                    console.log("No file selected");
                }
                
                // Clean up the temporary input element
                document.body.removeChild(oFileInput);
            }.bind(this));
            
            // Add to DOM and trigger click
            document.body.appendChild(oFileInput);
            oFileInput.click();
        },
        
        // Process imported file
        _processImportFile: function(oFile) {
            console.log("=== PROCESSING IMPORT FILE ===");
            console.log("File details:", {
                name: oFile.name,
                type: oFile.type,
                size: oFile.size,
                lastModified: new Date(oFile.lastModified)
            });
            
            var oFileReader = new FileReader();
            
            oFileReader.onload = function(oEvent) {
                try {
                    var sContent = oEvent.target.result;
                    console.log("File content loaded, length:", sContent.length);
                    
                    var aImportedData = [];
                    
                    // Try to parse as JSON first
                    if (oFile.type === "application/json" || oFile.name.toLowerCase().endsWith(".json")) {
                        try {
                            var oParsedData = JSON.parse(sContent);
                            if (Array.isArray(oParsedData)) {
                                aImportedData = oParsedData;
                            } else if (oParsedData.results && Array.isArray(oParsedData.results)) {
                                aImportedData = oParsedData.results;
                            } else {
                                throw new Error("JSON file must contain an array or object with 'results' array property");
                            }
                        } catch (oError) {
                            console.error("JSON parsing error:", oError);
                            this._showMessageToast("Error parsing JSON file: " + oError.message);
                            return;
                        }
                    }
                    // Parse CSV file
                    else if (oFile.type === "text/csv" || oFile.name.toLowerCase().endsWith(".csv")) {
                        aImportedData = this._parseCSVContent(sContent);
                    }
                    // For other file types, show error
                    else {
                        this._showMessageToast("Unsupported file type. Please use JSON or CSV files.");
                        return;
                    }
                    
                    console.log("Parsed data:", aImportedData);
                    
                    if (aImportedData.length > 0) {
                        this._importDataToTable(aImportedData, oFile.name);
                    } else {
                        this._showMessageToast("No valid data found in the file.");
                    }
                    
                } catch (oError) {
                    console.error("File processing error:", oError);
                    this._showMessageToast("Error processing file: " + oError.message);
                }
            }.bind(this);
            
            oFileReader.onerror = function() {
                console.error("File reading error");
                this._showMessageToast("Error reading file. Please try again.");
            }.bind(this);
            
            // Read file as text
            oFileReader.readAsText(oFile);
        },
        
        // Parse CSV content
        _parseCSVContent: function(sContent) {
            var aLines = sContent.split(/\r?\n/);
            var aHeaders = [];
            var aData = [];
            
            for (var i = 0; i < aLines.length; i++) {
                var sLine = aLines[i].trim();
                if (!sLine) continue;
                
                var aValues = sLine.split(",").map(function(sValue) {
                    return sValue.trim().replace(/^["'](.*)["']$/, "$1"); // Remove quotes
                });
                
                if (i === 0) {
                    aHeaders = aValues;
                } else {
                    var oRow = {};
                    for (var j = 0; j < aHeaders.length; j++) {
                        oRow[aHeaders[j]] = aValues[j] || "";
                    }
                    aData.push(oRow);
                }
            }
            
            console.log("CSV headers:", aHeaders);
            console.log("CSV data rows:", aData.length);
            
            return aData;
        },
        
        // Import data to table
        _importDataToTable: function(aImportedData, sFileName) {
            console.log("=== IMPORTING DATA TO TABLE ===");
            
            var oModel = this.getView().getModel("productModel");
            var aCurrentResults = oModel.getProperty("/results") || [];
            var oNow = new Date();
            var aValidData = [];
            
            // Process each imported item
            aImportedData.forEach(function(oItem, iIndex) {
                // Create a valid product object with all required fields
                var oProduct = {
                    Keyid: oItem.Keyid || this._generateKeyId(),
                    SalesOrganization: oItem.SalesOrganization || "IMPORTED",
                    DistributionChannel: oItem.DistributionChannel || "00",
                    OrganizationDivision: oItem.OrganizationDivision || "00",
                    SoldToParty: oItem.SoldToParty || "IMPORT_CUSTOMER",
                    Product: oItem.Product || "IMPORTED_PRODUCT_" + (iIndex + 1),
                    Quantity: parseFloat(oItem.Quantity) || 1.0,
                    Unit: oItem.Unit || "EA",
                    LocalCreatedBy: "FILE_IMPORT",
                    LocalCreatedAt: oNow.toISOString(),
                    LocalLastChangedBy: "FILE_IMPORT",
                    LocalLastChangedAt: oNow.toISOString(),
                    LastChangedAt: oNow.toISOString(),
                    selected: false
                };
                
                aValidData.push(oProduct);
            }.bind(this));
            
            console.log("Valid imported data:", aValidData.length, "items");
            
            // Merge with existing data
            var aCombinedResults = aCurrentResults.concat(aValidData);
            
            // Update model
            oModel.setProperty("/results", aCombinedResults);
            
            console.log("Total items after import:", aCombinedResults.length);
            console.log("=== IMPORT COMPLETED ===");
            
            // Show success message
            this._showMessageToast("Successfully imported " + aValidData.length + " items from " + sFileName);
            
            // Update UI
            this._updateToolbarButtons();
            this._updateSummary();
        },
        
        // Cleanup method for controller destruction
        onExit: function() {
            // Close any open dialogs
            if (this._oCurrentEditDialog) {
                this._oCurrentEditDialog.close();
                this._oCurrentEditDialog = null;
            }
        }
    });
});

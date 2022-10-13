const productModel = require('../models/productModel');
const validator = require("../validations/validator");
const { uploadFile } = require('../aws/aws');


//================================================ creating product ==============================================

const createProduct = async function (req, res) {
    try {
        let data = req.body;
        let files = req.files;

        let { title, description, price, currencyId, currencyFormat, isFreeShipping, style, availableSizes, installments } = data;

        //================================== if body is empty ==============================================
        if (!validator.isValidBody(data)) return res.status(400).send({ status: false, message: "Please provide data in body" });

        //=================================== title validation ================================================
        if (!title) return res.status(400).send({ status: false, message: "Title is mandatory" });
        if (!validator.isValid(title)) return res.status(400).send({ status: false, message: "Title is in wrong format" });
        req.body.title = title.replace(/\s+/g, ' ').toLowerCase()
        //===================================== duplicate title ===========================================
        let duplicateTitle = await productModel.findOne({ title: title })
        if (duplicateTitle) return res.status(400).send({ status: false, message: "Title already exist" })

        //==================================== description is mandatory ===============================
        if (!description) return res.status(400).send({ status: false, message: "Description is mandatory" });
        if (!validator.isValid(description)) return res.status(400).send({ status: false, message: "description is in wrong format" });
        req.body.description = description.replace(/\s+/g, ' ').toLowerCase()

        //==================================== price is required =========================================
        if (!price) return res.status(400).send({ status: false, message: "price is Required" });
        if (!(validator.isValidNumber(price))) {
            return res.status(400).send({ status: false, message: "price should be a number" })
        }

        //===================================== currency id validation ================================
        if (currencyId) {
            if (!validator.isValid(currencyId)) return res.status(400).send({ status: false, message: " currencyId should not be an empty string" });

            if (!(/INR/.test(currencyId))) return res.status(400).send({ status: false, message: " currencyId should be in 'INR' Format" });
        } else {
            data.currencyId = "INR"
        }

        //=================================== currencyformat validation ================================
        if (currencyFormat) {
            if (!validator.isValid(currencyFormat)) return res.status(400).send({ status: false, message: "Currency format of product should not be empty" });

            if (!(/₹/.test(currencyFormat))) return res.status(400).send({ status: false, message: "Currency format of product should be in '₹' " });
        } else {
            data.currencyFormat = "₹"
        }

        //=================================== isfreeshipping validation ===================================
        if (isFreeShipping) {
            if (typeof isFreeShipping == "string") {
                data.isFreeShipping = isFreeShipping.toLowerCase();
                if (isFreeShipping == 'true' || isFreeShipping == 'false') {
                    isFreeShipping = JSON.parse(isFreeShipping)
                } else {
                    return res.status(400).send({ status: false, message: "Please enter true or false" }) 
                }
            }
        }
        
        //============================= productimage validation =============================================
        if (files.length == 0) return res.status(400).send({ status: false, message: "ProductImage is required" });
        let productImgUrl = await uploadFile(files[0]);
        data.productImage = productImgUrl;

        //=============================== style validation ===================================================
        if (style) {
            if (!validator.isValid(style)) return res.status(400).send({ status: false, message: "Style should be valid an does not contain numbers" });
        }

        //================================ availablesizes validation ==========================================
        if (!availableSizes) return res.status(400).send({ status: false, message: " availableSizes is Required" });
        if (availableSizes) {
            let size = availableSizes.toUpperCase().split(",")
            data.availableSizes = size;
            for (let i = 0; i < data.availableSizes.length; i++) {
                if (!validator.isValidSize(data.availableSizes[i])) {
                    return res.status(400).send({ status: false, message: "Size should be one of these - 'S', 'XS', 'M', 'X', 'L', 'XXL', 'XL'" });
                }
            }
        }

        //========================================= installments validations ===============================
        if (installments) {
            if (!(validator.isValidNumber(installments))) {
                return res.status(400).send({ status: false, message: "installments should be a number" })
            }
        }

        let createProduct = await productModel.create(data);
        return res.status(201).send({ status: true, message: "product created sucessfully", data: createProduct });
    } catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}




//========================================== get product details =======================================

const getProduct = async function (req, res) {
    try {
        let queryData = req.query
        let { size, name, priceGreaterThan, priceLessThan, priceSort } = queryData
        //===========================if no query then filter with isDeleted:false========================
        if (Object.keys(queryData).length == 0) {
            let filterData = await productModel.find({ isDeleted: false })
            return res.status(200).send({ status: true, message: `Found ${filterData.length} Items`, data: filterData })
        }
        let keys = "size, name, priceGreaterThan, priceLessThan, priceSort"
        
        //============================= if query is present ============================================
        if (size || priceSort || priceLessThan || priceGreaterThan || name) {

            let objectFilter = { isDeleted: false }
            //================================ if size query is present ==========================================
            if (size) {
                let checkSizes = ["S", "XS", "M", "X", "L", "XXL", "XL"]
                let arraySize = size.split(",")
                for (let i = 0; i < arraySize.length; i++) {
                    if (checkSizes.includes(arraySize[i])) {
                        continue;
                    }
                    else {
                        return res.status(400).send({ status: false, message: "Sizes should in this ENUM only S/XS/M/X/L/XXL/XL" })
                    }
                }
                objectFilter["availableSizes"] = {$in:arraySize}
            }
            //==================================== if name query is present ======================================
            if (name) {
                if (!validator.isValid(name)) return res.status(400).send({ status: false, message: "Name should not be empty" })
                name = name.replace(/\s+/g, ' ').trim()
                objectFilter["title"] = { $regex: name, $options: 'i' }
            }
            //=============================== if pricegreaterthen is present =========================
            if (priceGreaterThan) {
                if (!validator.isValid(priceGreaterThan)) return res.status(400).send({ status: false, message: "priceGreaterThan is empty" })
                if (!validator.isValidNumber(priceGreaterThan)) return res.status(400).send({ status: false, message: "You entered invalid priceGreaterThan.please enter number." })
                objectFilter["price"] = {$gt :priceGreaterThan}
            }
            //================================ if pricelessthen is present ====================================
            if (priceLessThan) {
                if (!validator.isValid(priceLessThan)) return res.status(400).send({ status: false, message: "priceLessThan is empty" })
                if (!validator.isValidNumber(priceLessThan)) return res.status(400).send({ status: false, message: "You entered invalid priceLessThan" })
                objectFilter["price"] = { $lt: priceLessThan }

            }
            //================== if both pricegreaterthan and pricelessthan is present ===================
            if (priceGreaterThan && priceLessThan) {
                objectFilter['price'] = { $gt: priceGreaterThan, $lt: priceLessThan }
            }
            //========================= if pricesort query is present ==================================
            if (priceSort) {
                if(validator.isValid(priceSort)){
                if (!(priceSort == "1" || priceSort == "-1")) return res.status(400).send({ status: false, message: "You entered an invalid input sorted By can take only two Inputs 1 OR -1" })
            }
            }

            //========================== fetching data using filters =======================================
            let findFilter = await productModel.find(objectFilter).sort({ price: priceSort })
            if (findFilter.length == 0) return res.status(404).send({ status: false, message: "No product Found" })

            return res.status(200).send({ status: true, message: `${findFilter.length} Match Found`, data: findFilter })
        }
        else {
            return res.status(400).send({ status: false, message: `Cannot provide keys other than ${keys}` })
        }
    }
    catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}

//=========================================== get product by productid ================================
const getProductById = async function (req, res) {
    try {
        let requestBody = req.params.productId
        if (!validator.isValidObjectId(requestBody)) {
            return res.status(400).send({ status: false, message: "productid is of invalid format" })
        }
        //===================================== getting non deleted data =================================
        let productCheck = await productModel.findOne({ _id: requestBody, isDeleted: false })
        if (!productCheck) {
            return res.status(404).send({ status: false, message: "product not found or the product is deleted" })
        }
        res.status(200).send({ status: false, data: productCheck })
    }
    catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}


//==================================== update product details ====================================

const updateProduct = async function (req, res) {
    try {

    }
    catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}


//================================================== delete products ====================================

const deleteProduct = async (req, res) => {
    try {
        let product = req.params.productId
        //=================================== productid validation =================================
        if (!validator.isValidObjectId(product)) {
            return res.status(400).send({ status: false, message: "Please provide valid Product Id" })
        }

        let getId = await productModel.findOne({ _id: product, isDeleted: false });
        if (!getId) {
            return res.status(404).send({ status: false, message: "Product Not Found!!!!!!!!!!!!!! or product may be deleted already" })
        }

        await productModel.updateOne({ _id: product }, { isDeleted: true, deletedAt: Date.now() })
        return res.status(200).send({ status: true, message: "Product is deleted successfully" })
    }
    catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }

};



module.exports = { createProduct, getProduct, getProductById, updateProduct, deleteProduct }
const fetch = require('node-fetch')
const bodyParser = require('body-parser')
module.exports = function cronosBatch(clientOrders,client,products,context,callback){

  let data = {
    "use_order_batch": false,
    "business_line": "Stahls Full Gear",
    "client_attributes": {
      "client_name": client.client_name,
      "external_client_id": client.xid,
      "billing_street_1": client.street1,
      "billing_street_2": client.street2,
      "billing_city": client.city,
      "billing_state": client.state,
      "billing_country": client.country,
      "billing_postal": client.zip,
      "first_name": client.client_contact_info.first_name || "N/A",
      "last_name": client.client_contact_info.last_name,
      "phone": client.client_contact_info.phone,
      "email": client.client_contact_info.email
    },
    "external_id": "",
    "purchase_order_number": "",
    "orders": []
  }

  addOrder(clientOrders,products,(res)=>{
    data.orders = data.orders.concat(res)
    callback(data)
  })

  function addOrder(clientOrders,products,callback){
    let orders = []
    var orderInfo = {
      "external_id": clientOrders[0].order_number,
      "order_date": clientOrders[0].created_at,
      "purchase_order_number": null,
      "production_label":"blank",
      "shipping_method": "Mail Innovations",
      "order_items_attributes":[],
      "customer_attributes":{
        "first_name": clientOrders[0].customer["first_name"]|| "N/A",
        "last_name": clientOrders[0].customer["last_name"],
        "email": clientOrders[0].customer["email"],
        "shipping_street_1": clientOrders[0].shipping_address["address1"],
        "shipping_street_2": clientOrders[0].shipping_address["address2"],
        "shipping_city": clientOrders[0].shipping_address["city"],
        "shipping_state": clientOrders[0].shipping_address["province"],
        "shipping_postal": clientOrders[0].shipping_address["zip"],
        "shipping_country": clientOrders[0].shipping_address["country"],
        "phone": clientOrders[0].customer["phone"],
        "company_name": clientOrders[0].shipping_address["company"],
      }
    }
    lineItemController(clientOrders[0],products,(res)=>{
      orderInfo.order_items_attributes = orderInfo.order_items_attributes.concat(res)
      orders.push(orderInfo)
      clientOrders.shift()
      if(clientOrders.length !== 0){
        addOrder(clientOrders,products,(res)=>{
          orders = orders.concat(res)
        })
      }
      callback(orders)
    })
  }
  function getMetaDataObject(properties){
    const data = {}
    for(let entry of properties){
      if(entry.name.match(/size/i)=== null){
        switch(true){
          case(entry.name.match(/name/i)!== null):data["player_name"] = entry.value
          case(entry.name.match(/number/i)!== null): data["player_number"] = entry.value
        }
      }
    }
    return data
  }
  function lineItemController(clientOrder,products,callback){
    let lineItemCount = 0;
    const allLineItems = []
    const lineItemRequest = []
    let lineItemParams;
    for(let item of clientOrder.line_items){
      for(let product of products){
        if(product.id === item.product_id){
          let bundleList = item.sku.replace(/ /g, "").split("|")
          for (i = 0; i < bundleList.length; i++) {
            if(bundleList[i] === ""){
              bundleList.splice(i,1)
            }
          }
          if(bundleList.length > 1){
            for(i=0;i<bundleList.length;i++){
              lineItemCount ++
              for( let bundleCheck of products ){
                for(let variant of bundleCheck.variants ){
                  if(variant.sku === bundleList[i]){
                    let size = item.properties[i].value
                    let meta = getMetaDataObject(item.properties)
                    lineItemParams = {
                      size:size,
                      gender:null,
                      item:item,
                      product:bundleCheck,
                      variant:variant,
                      bundle_list:bundleList,
                      meta_data:meta,
                      file_name:clientOrder.order_number+"_"+lineItemCount
                    }
                    lineItemRequest.push(lineItemParams)
                  }
                }
              }
            }
          }else{
            lineItemCount ++
            let meta = getMetaDataObject(item.properties)
            var size,gender;
            if(item.properties.length > 0){
             for(let property of item.properties){
              if(property.name === "details"){
                size = property.value.size
              }else{
                let scrubbedName = property.name.toLowerCase().replace(/[\!\@\#\$\ \%\^\&\*\(\)\_\+\\\-\=\[\]\{\}\|\:\;\'\"\,\.\<\>\?\/]/g, "")
                if(scrubbedName === "size"){
                  size = property.value
                }
                if(scrubbedName === "gender"){
                  gender = property.value
                }
              }
            }

            }
            if(size === undefined){
              for(let variant of product.variants){
                if(item.variant_id === variant.id){
                  size = variant.option2 || variant.option1
                }
              }
              if(size === undefined){
                size = "NA"
              }
            }
            if(gender === undefined){
              gender = "NA"
            }
            lineItemParams = {
              size:size,
              gender:gender,
              item:item,
              product:product,
              variant:null,
              bundle_list:null,
              meta_data:meta,
              file_name:clientOrder.order_number+"_"+lineItemCount
            }
            lineItemRequest.push(lineItemParams)
          }
        }
      }
      }
      addLineItems(lineItemRequest,(res)=>{
        callback(res)
      })
  }

  function addLineItems(params,callback){
    getExternalPdfUrl(params[0].size,params[0].item,params[0].file_name,(error,result,type)=>{
      let lineItems = [];
      let lineItem;
      let pdfUrl;
      if(result) pdfUrl = result.body
      if (params[0].bundle_list && params[0].bundle_list.length>0){
        lineItem = {
          "type": type,
          "name": params[0].product.title,
          "sku": params[0].variant.sku.match(/^[A-Za-z0-9]+\-[A-Za-z0-9]+\-[A-Za-z0-9]+/g)[0]+"-"+params[0].size,
          "quantity": params[0].item.quantity,
          "gender": "NA",
          "size": params[0].size,
          "external_image_url": params[0].product.image?params.product.image.src:null,
          "external_pdf_url": pdfUrl || null,
          "external_sku": params[0].variant.sku,
          "price": params[0].variant.price,
          "meta_data": params[0].meta_data
        }
      }else{
        lineItem = {
          "type": type,
          "name": params[0].product.title,
          "sku": params[0].item.sku.match(/^[A-Za-z0-9]+\-[A-Za-z0-9]+\-[A-Za-z0-9]+/g)[0]+"-"+params[0].size,
          "quantity": params[0].item.quantity,
          "gender": params[0].gender,
          "size": params[0].size,
          "external_image_url": params[0].product.image?params[0].product.image.src:null,
          "external_pdf_url": pdfUrl || null,
          "external_sku": params[0].item.sku,
          "price": params[0].item.price,
          "meta_data": params[0].meta_data
        }
      }
      lineItems.push(lineItem)
      params.shift()
      if(params.length !== 0){
        addLineItems(params,(res)=>{
          lineItems = lineItems.concat(res)

          callback(lineItems)
        })
      }else{
        callback(lineItems)
      }
    })
  }

  function getExternalPdfUrl(size,item,fileName,callback){
    let docId,model_path,style,type,design,sku,properties;
    try{
      if(item.properties){
        let isBuilder = false
        for(let property of item.properties){
          if(property.name === "document_id") docId = property.value
          if(property.name === "details" && property.value.model_path){
            isBuilder = true
            type = "builder"
            model_path = property.value.model_path
            style = property.value.cut
            design = property.value.design.replace(/^[0-9A-Za-z]+_/,"")
          }
        }
        if(isBuilder === false){
          type = "teamstore",
          properties = item.properties,
          sku = item.sku
        }
      }else{
        type = "nocustom"
      }
      if(type === "teamstore" || type === "builder"){
        const url = 'https://sfg-integration.azurewebsites.net/api/CobblerElf?code=3fFvSgogHxt0r7qcTZDVSWqzhzwlSlpfN5hpfnzBn6wi5SY2HD/Y6g=='
        const body = {
          "store": client.client_name.replace(/[\`~!@#$%^&*\(\)-_=+\{\}\[\]\\|;:\'\"<>,.?\/]/g,""),
          "type": type,
          "docId": docId,
          "size": size,
          "model_path": model_path,
          "style": style.toUpperCase() || null,
          "design":design,
          "file_name": fileName,
          "properties": properties,
          "sku":sku
        }
        fetch(url,{
          'method': 'POST',
          'body': JSON.stringify(body),
          'headers': {
            'Content-Type':'application/json'
          }
        }).then(res => res.json())
          .then(json => callback(null,json,type))
          .catch(e => callback(e,null,type))
      }else{
        callback()
      }
    }catch(e){

      callback(e,null)
    }
  }
}

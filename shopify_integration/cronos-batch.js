module.exports = class CronosBatch{
  constructor(clientOrders,client,products,context){
    this.context = context
    this.data = {
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
        "first_name": client.client_contact_info.first_name,
        "last_name": client.client_contact_info.last_name,
        "phone": client.client_contact_info.phone,
        "email": client.client_contact_info.email
      },
      "external_id": "",
      "purchase_order_number": "",
      "orders": []
    }

    for(let clientOrder of clientOrders){
      this.addOrder(clientOrder,products)
    }
  }

  addOrder(clientOrder,products){
    var orderInfo = {
      "external_id": clientOrder.order_number+"NEWtest7",
      "order_date": clientOrder.created_at,
      "purchase_order_number": null,
      "production_label":"blank",
      "shipping_method": "Mail Innovations",
      "order_items_attributes":[],
      "customer_attributes":{
        "first_name": clientOrder.customer["first_name"],
        "last_name": clientOrder.customer["last_name"],
        "email": clientOrder.customer["email"],
        "shipping_street_1": clientOrder.shipping_address["address1"],
        "shipping_street_2": clientOrder.shipping_address["address2"],
        "shipping_city": clientOrder.shipping_address["city"],
        "shipping_state": clientOrder.shipping_address["province"],
        "shipping_postal": clientOrder.shipping_address["zip"],
        "shipping_country": clientOrder.shipping_address["country"],
        "phone": clientOrder.customer["phone"],
        "company_name": clientOrder.shipping_address["company"],
      }
    }
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
              for( let bundleCheck of products ){
                for(let variant of bundleCheck.variants ){
                  if(variant.sku === bundleList[i]){
                    let size = item.properties[i].value
                    let meta = this.getMetaDataObject(item.properties)
                    let lineItem = this.addLineItem(size,null,item,bundleCheck,variant,bundleList,meta)
                    orderInfo.order_items_attributes.push(lineItem)
                  }
                }
              }
            }
          }else{
            let meta = this.getMetaDataObject(item.properties)
            var size,gender;
            for(let property of item.properties){
              let scrubbedName = property.name.toLowerCase().replace(/[\!\@\#\$\ \%\^\&\*\(\)\_\+\\\-\=\[\]\{\}\|\:\;\'\"\,\.\<\>\?\/]/g, "")
              if(scrubbedName === "size"){
                size = property.value
              }
              if(scrubbedName === "gender"){
                gender = property.value
              }
            }
            if(size === undefined){
              for(let variant of product.variants){
                if(product.variant_title === variant.title){
                  size = variant.option2
                }
              }
              if(size === undefined){
                size = "NA"
              }
            }
            if(gender === undefined){
              gender = "NA"
            }
            let lineItem = this.addLineItem(size,gender,item,product,null,null,meta)
            orderInfo.order_items_attributes.push(lineItem)
          }
        }
      }
      }
    this.data.orders.push(orderInfo)
  }
  getMetaDataObject(properties){
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
  addLineItem(size,gender,item,product,variant,bundleList,meta){
    let lineItem;
    if (bundleList && bundleList.length>0){
      lineItem = {
        "name": product.title,
        "sku": variant.sku.match(/^[A-Za-z0-9]+\-[A-Za-z0-9]+\-[A-Za-z0-9]+/g)[0]+"-"+size,
        "quantity": item.quantity,
        "gender": "NA",
        "size": size,
        "external_image_url": product.image.src,
        "external_pdf_url": "",
        "external_sku": variant.sku,
        "price": variant.price,
        "meta_data": meta
      }
    }else{
      lineItem = {
        "name": product.title,
        "sku": item.sku.match(/^[A-Za-z0-9]+\-[A-Za-z0-9]+\-[A-Za-z0-9]+/g)[0]+"-"+size,
        "quantity": item.quantity,
        "gender": gender,
        "size": size,
        "external_image_url": product.image.src,
        "external_pdf_url": "",
        "external_sku": item.sku,
        "price": item.price,
        "meta_data": meta
      }
    }
    return lineItem
  }
}

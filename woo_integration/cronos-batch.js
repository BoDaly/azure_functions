module.exports = class CronosBatch{
  constructor(clientOrders,products,client,context){
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
      this.addLineItem(clientOrder,products)
    }
  }

  addLineItem(clientOrder,products){
    var orderInfo = {
      "external_id": clientOrder.id,
      "order_date": clientOrder.date_modified,
      "purchase_order_number": clientOrder.order_key,
      "production_label":"blank",
      "shipping_method": "Mail Innovations",
      "order_items_attributes":[],
      "customer_attributes":{
        "first_name": clientOrder.shipping["first_name"],
        "last_name": clientOrder.shipping["last_name"],
        "email": clientOrder.billing["email"],
        "shipping_street_1": clientOrder.shipping["address_1"],
        "shipping_street_2": clientOrder.shipping["address_2"],
        "shipping_city": clientOrder.shipping["city"],
        "shipping_state": clientOrder.shipping["state"],
        "shipping_postal": clientOrder.shipping["postcode"],
        "shipping_country": clientOrder.shipping["country"],
        "phone": clientOrder.billing["phone"],
        "company_name": clientOrder.shipping["company"],
      }
    }
    for(let item of clientOrder.line_items){
      for(let product of products){
        if(product.id === item.product_id){
          var size,gender;
          for(let meta of item.meta_data){
            if(meta.key && meta.key === "pa_gender"){
              gender = meta.value
            }
            else{
              gender = "NA"
              if(meta.key && meta.key === "pa_size"){
                size = meta.value
              }
              else{
                size = "NA"
              }
            }
          }
          if(size === undefined){
            size = "NA"
          }
          if(gender === undefined){
            gender = "NA"
          }

          var lineItem = {
            "name": product.slug,
            "sku": item.sku.match(/^[A-Za-z0-9]+\-[A-Za-z0-9]+\-[A-Za-z0-9]+\-[A-Za-z0-9]+/g)[0],
            "quantity": item.quantity,
            "gender": gender,
            "size": size,
            "external_image_url": product.images[0].src,
            "external_pdf_url": "",
            "external_sku": item.sku,
            "price": item.price,
            "meta_data": {"meta_array":item.meta_data}
          }
          orderInfo.order_items_attributes.push(lineItem)
        }



      }
    }
    this.data.orders.push(orderInfo)
  }
}

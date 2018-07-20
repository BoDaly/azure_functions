const ShopifyAPI = require('shopify-api-node')
const fetch = require('node-fetch')
const cronosBatch = require('./cronos-batch')
const YAML = require('yamljs')
const fs = require('fs')
const moment = require('moment')
const stagingEndPoint = "http://cronos-staging.herokuapp.com/api/v1/orders/?email=softwareadmin@fullgear.com&auth_token=861a42ed-d30d-4e03-9d66-59c2a97699a8"
const cronosEndPoint = "https://portal.fullgear.com/api/v1/orders/?email=softwareadmin@fullgear.com&auth_token=416da16d-5d41-4001-96db-5dd6448d6e45"
const staging = {};
staging.on = false
staging.local = false
staging.number = 2
let context;
if(staging.local === true){
  context = console
}
//azureFunction()

function setFilterDate(type){
  const now = moment().format("YYYY-MM-DDTHH:mm:ss")
  const yesterday = moment(now).subtract(1,'days').format("YYYY-MM-DDTHH:mm:ss")
  const weekend = moment(now).subtract(2,'days').format("YYYY-MM-DDTHH:mm:ss")
  if(moment(now).day() === 0){
    if(type === "browser"){
      return weekend.replace(/\:/g, "%3A")
    }else{
      return weekend
    }
  }else{
    if(type === "browser"){
      return yesterday.replace(/\:/g, "%3A")
    }else{
      return yesterday
    }
  }
}
// Load Client Info Config (YAML)
// Iterate through Clients and .
// Get Client Orders since yesterday.
//function azureFunction(){
  module.exports = function(context,myTimer){
  const filterDate = setFilterDate()//"2018-06-25T00:00:00"
  let clientInfo;
  loadClient((err,res)=>{
    if(err){
      context.log(err)
    }else{
      clientInfo = res
    }
  })

  for(i=0;i<clientInfo.length;i++){
    let currentClient;
    if(staging.on === true){
      currentClient = clientInfo[staging.number]
    } else{
      currentClient = clientInfo[i]
    }
    let storeName,apiKey,apiSecret;
    if(staging.on === true){
      storeName = currentClient.staging_store_name
      apiKey = currentClient.staging_api_key
      apiSecret = currentClient.staging_api_secret
    } else{
      storeName = currentClient.prod_store_name
      apiKey = currentClient.prod_api_key
      apiSecret = currentClient.prod_api_secret

    }
    if(currentClient.active === true){
      let Shopify = new ShopifyAPI({
        shopName: storeName,
        apiKey: apiKey,
        password: apiSecret
      });
      promiseGatherer(Shopify,filterDate,currentClient).then((allPromises) => {
        Promise.all(allPromises).then((promises) => {
          return makeBatch(promises[0],promises[1],filterDate,currentClient,context)
        }).then((result) => {
          let endPoint;
          if(staging.on === true){endPoint = stagingEndPoint}else{endpoint = cronosEndPoint}
          fetch(endPoint, {
          method: 'POST',
          body: JSON.stringify(result),
          headers: {
          'Content-Type': 'application/json',
          //'X-Api-Key': "ddd7204996f9a182",
          //'X-Secret-Key': "dQGxO_XIBEPq2bB0FKy8eg"
          }
          }).then((response) => {
          context.log("STATUS: "+JSON.stringify(response.status))
          //context.done()
          }).catch((error) => {
          //context.log('--catch--')
          context.log("Cronos Import Error: "+error)
          //context.done()
          });

        }).catch((error) => {
          context.log("Promises: "+error);
        })
      }).then((response) => {
        context.log("Resolve: "+response);
      }).catch((error) => {
        context.log("Function Error: "+error);
      })
      if(staging.on === true){
        break
      }
    }
  }
  if(staging.local !== true || staging.on !== true){
    context.done()
  }

}

function loadClient(callback){
  if(staging.local === true){
    try {
      callback(null,YAML.load('clients.yml'));
    } catch (e) {
      callback("YAML-load: "+e)
    }
  }else{
    try {
      callback(null, YAML.load('D:\\home\\site\\wwwroot\\shopify-integration\\clients.yml'));
    } catch (e) {
      callback("YAML-load: "+e)
    }
  }
}

function getProducts(Shopify,currentClient){
  return new Promise((resolve,reject) => {
     Shopify.product.count({
      vendor: "Full Gear"
    }).then((response)=>{
      const productPromises = [];
      for(i=1;i<=Math.ceil(response/250);i++){
        let products = Shopify.product.list({
          vendor: "Full Gear",
          limit: 250,
          page: i
        }).then((result)=>{
          return result
        })
        productPromises.push(products)
      }
      if(productPromises.length < 1){
        reject(`There are no Full Gear Products in ${currentClient.client_name}'s Store`)
      }else {
        Promise.all(productPromises).then((results) => {
          let fgProducts = [];
          for(i=0;i<results.length;i++){
            fgProducts = fgProducts.concat(results[i])
          }
          if(fgProducts.length < 1){
            reject(`something went wrong when concanting the Client Order pages`)
          }else{
            resolve(fgProducts)
          }
        })
      }
    })
  })
}

function getOrders(Shopify, filterDate,currentClient){
  return new Promise((resolve,reject) => {
    Shopify.order.count({
      created_at_min: filterDate
    }).then((response) => {
      const orderPromises =[]
      for(i=1;i<=Math.ceil(response/250);i++){
        let orders = Shopify.order.list({
          fulfillment_status: "unshipped",
          limit: 250,
          page: i,
          created_at_min: filterDate
        }).then((result) => {
          return result
        })
        orderPromises.push(orders)
      }
      if(orderPromises.length < 1){
        reject(`There are no new Client Orders by ${currentClient.client_name} between ${setFilterDate()} and ${moment().format("YYYY-MM-DDTHH:mm:ss")}`)
      }else {
        Promise.all(orderPromises).then((results) => {
          let clientOrders = [];
          for(i=0;i<results.length;i++){
            clientOrders = clientOrders.concat(results[i])
          }
          if(clientOrders.length < 1){
            reject(`something went wrong when concanting the Client Order pages`)
          }else{
            const fgOrders = findFullGearOrders(clientOrders)
            if(fgOrders.length < 1){
              reject(`There are no new Full Gear Orders by ${currentClient.client_name} between ${setFilterDate()} and ${moment().format("YYYY-MM-DDTHH:mm:ss")}`)
            }else{
              resolve(fgOrders)
            }
          }
        })
      }
    })
  })
}

function promiseGatherer(Shopify,filterDate,currentClient){
  return Promise.all([getProducts(Shopify,currentClient),getOrders(Shopify,filterDate,currentClient)])
}

function makeBatch(productsPromise,ordersPromise,filterDate,currentClient,context){
  return new Promise((resolve,reject) => {
    if(productsPromise === undefined || ordersPromise === undefined){
      reject("Something Went Wrong")
    }else {
      const fgOrders = findFullGearOrders(ordersPromise)
      if(fgOrders.length<1){
        reject(`There are no new Client Orders by ${currentClient.client_name} between ${setFilterDate()} and ${moment().format("YYYY-MM-DDTHH:mm:ss")}`)
      }else{
        cronosBatch(fgOrders,currentClient,productsPromise,context,(res)=>{
          if(res === undefined){
            reject(`${currentClient.client_name}: Something went wrong in the CronosBatch object`)
          }else {
            //context.log(res.orders[0].order_items_attributes)
            resolve(res)
          }
        })
      }
    }
  })
}

function findFullGearOrders(clientOrders){
  let fgOrders = []
  for (let order of clientOrders) {
    let breaker = false
    for (let item of order.line_items){
      let verifier;
      if(item.vendor) verifier = item.vendor.toLowerCase().replace(/[\!\@\#\$\ \%\^\&\*\(\)\_\+\\\-\=\[\]\{\}\|\:\;\'\"\,\.\<\>\?\/]/g, "")
      if(verifier === "fullgear"){
        fgOrders.push(order)
        breaker = true
        break
      }
      if(breaker === true){
        break
      }
    }
  }
  return fgOrders
}

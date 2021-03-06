const ShopifyAPI = require('shopify-api-node')
const fetch = require('node-fetch')
const CronosBatch = require('./cronos-batch')
const YAML = require('yamljs')
const fs = require('fs')
const moment = require('moment')
const cronosEndPoint = "http://cronos-staging.herokuapp.com/api/v1/orders/?email=softwareadmin@fullgear.com&auth_token=861a42ed-d30d-4e03-9d66-59c2a97699a8"
const staging = {};
staging.on = true
staging.number = 0
azureFunction()
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
function azureFunction(){
  // module.exports = function(console,myTimer){
  const filterDate = setFilterDate()
  const clientInfo = loadClient()
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
          return makeBatch(promises[0],promises[1],filterDate,currentClient)
        }).then((result) => {

          fetch(cronosEndPoint, {
          method: 'POST',
          body: JSON.stringify(result.data),
          headers: {
          'Content-Type': 'application/json',
          //'X-Api-Key': "ddd7204996f9a182",
          //'X-Secret-Key': "dQGxO_XIBEPq2bB0FKy8eg"
          }
          }).then((response) => {
          console.log("STATUS: "+JSON.stringify(response.status))
          //console.done()
          }).catch((error) => {
          //console.log('--catch--')
          console.log("Cronos Import Error: "+error)
          //console.done()
          });

        }).catch((error) => {
          console.log("Promises: "+error);
        })
      }).catch((error) => {
        console.log("Function Error: "+error);
      })
      if(staging.on === true){
        break
      }
    }
  }
  // console.done()
}




function loadClient(console){
  try {
    return YAML.load('clients.yml');
  } catch (e) {
    console.log("YAML-load: "+e)
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
      console.log("GET/orders: "+response)
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
        let cronosBatch = new CronosBatch(fgOrders,currentClient,productsPromise)
        if(cronosBatch === undefined){
          reject(`${currentClient.client_name}: Something went wrong in the CronosBatch object`)
        }else {
          resolve(cronosBatch)
        }
      }
    }
  })
}

function findFullGearOrders(clientOrders){
  let fgOrders = []
  for (let order of clientOrders) {
    let breaker = false
    for (let item of order.line_items){
      let verifier = item.fulfillment_service.toLowerCase().replace(/[\!\@\#\$\ \%\^\&\*\(\)\_\+\\\-\=\[\]\{\}\|\:\;\'\"\,\.\<\>\?\/]/g, "")
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

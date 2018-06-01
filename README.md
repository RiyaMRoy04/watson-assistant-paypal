# Watson Assistant with Paypal Payment API integration

### To run the application locally

1. Update Watson Assistant Username, Password and Workspace ID in .env file

2. Install all dependency- **npm install**

3. Start the server- **npm start**

4. Run the application from browser: **localhost: 3000**


### Push the application to IBM Cloud

1. Update Watson Assistant Username, Password and Workspace ID in .env file

2. Login to IBM Cloud from command prompt- **bx login** and target the space in which your application is **bx target --cf**

3. Push the application to IBM Cloud from your working directory - **bx cf push** (It will invoke manifest.yml which has your app name/host name/service details etc)

4. Run the application from browser by going to the application name mentioned in the manifest.yml file.

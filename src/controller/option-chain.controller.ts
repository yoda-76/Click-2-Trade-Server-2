import axios from "axios";
import { AccountManager } from "../core/accountsManager";


export const optionChainController = (req: any, res: any) => {
    const {accountId, expiry, base} = req.body;
    const accountManager = AccountManager.getInstance();
    const account = accountManager.getAuthenticatedAccountsAsObject(`MASTER:${accountId}`);
    const access_token = account.accessToken;

    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(base)}&expiry_date=${expiry}`,
        headers: { 
          'Accept': 'application/json',
          Authorization: `Bearer ${access_token}`, // Ensure access_token is defined
        }
      };
      
      axios(config)
        .then((response) => {
        //   console.log(JSON.stringify(response.data));
          res.send(response.data.data);
        })
        .catch((error) => {
          console.log(error);
        });
      
};



// eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiJLTDI3NzAiLCJqdGkiOiI2NzE5ZjNhNGIzMDU5ZDZkOGYyYWQ1YzAiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaWF0IjoxNzI5NzU0MDIwLCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3Mjk4MDcyMDB9.z2_FSfekIlKxc1NYYHXTVCZM-_WzBMRGI4daRRlBPnc
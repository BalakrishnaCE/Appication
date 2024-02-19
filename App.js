import React, { useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, TextInput, Button, Alert, Text, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
const ERPNextURL = 'https://erpnoveloffice.in/Leads-Assignment/tracker(apptest)';



Sentry.init({
    dsn: 'https://c12bcf5819170bc0a8638a732a0fece3@o4506699776851968.ingest.sentry.io/4506745364807680',
    debug: false, // If `true`, Sentry will try to print out useful debugging information if something goes wrong with sending the event. Set it to `false` in production
  });

export default function App() {
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if the user is already logged in
    SecureStore.getItemAsync('isLoggedIn').then(storedIsLoggedIn => {
      setIsLoggedIn(storedIsLoggedIn === 'true');
      setIsLoading(false);
    });
  }, []);

  async function handleLogin() {
    setIsLoading(true);
    try {
      const response = await fetch('https://erpnoveloffice.in/api/method/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `usr=${encodeURIComponent(userEmail)}&pwd=${encodeURIComponent(userPassword)}`,
      });

      if (response.ok) {
        // Set 'isLoggedIn' flag after successful login
        await SecureStore.setItemAsync('isLoggedIn', 'true');
        setIsLoggedIn(true);

        // Register for push notifications and get the token
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus === 'granted') {
            const tokenData = await Notifications.getExpoPushTokenAsync({
              projectId: Constants.expoConfig.extra.eas.projectId,
            });
            const expoPushToken = tokenData.data;
            console.log("Push notification token:", expoPushToken);
          
            // Store the Expo push token for later use in logout
            await SecureStore.setItemAsync('expoPushToken', expoPushToken);
          
            // Send the email and Expo push token to ERPNext
            await sendTokenToERPNext(userEmail, expoPushToken);
          }
           else {
          console.log('Failed to get push token for push notification!');
        }
      } else {
        Alert.alert('Login Failed', 'Please check your credentials and try again.');
      }
    } catch (error) {
      Alert.alert('Login Error', 'An error occurred during login.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
}

async function sendTokenToERPNext(email, token) {
    try {
      const apiKey = 'ef122a54da1bfed';
      const apiSecret = 'f80c4ce51758a2a';
      
      // Assume we have an API or method to check if a record exists. Adjust the URL as needed.
      const checkResponse = await fetch(`https://erpnoveloffice.in/api/resource/Expo Token/${email}-${token}`, {
        method: 'GET',
        headers: {
          'Authorization': `token ${apiKey}:${apiSecret}`,
        },
      });

      if (checkResponse.ok) {
        console.log('Record already exists. No need to add again.');
        return; // Exit if record exists
      } else if (checkResponse.status === 404) {
        // Record does not exist, proceed to add
        const addResponse = await fetch('https://erpnoveloffice.in/api/resource/Expo Token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `token ${apiKey}:${apiSecret}`,
          },
          body: JSON.stringify({
            name: `${email}-${token}`, // Using email-token as ID
            email: email,
            token: token,
          }),
        });

        if (!addResponse.ok) {
          throw new Error('Failed to send token to ERPNext');
        }
        console.log('Record added successfully.');
      }
    } catch (error) {
      console.error('Error sending token to ERPNext:', error);
    }
}


async function handleLogout() {
    // Retrieve the Expo push notification token to construct the document ID
    const expoPushToken = await SecureStore.getItemAsync('expoPushToken'); // Assuming you've stored the token earlier
    const email = userEmail; // Assuming userEmail holds the email used to log in

    // Call function to delete the document from ERPNext
    await deleteTokenFromERPNext(email, expoPushToken);

    // Proceed with logout
    await SecureStore.deleteItemAsync('isLoggedIn');
    setIsLoggedIn(false);
    setUserEmail('');
    setUserPassword('');
}


async function deleteTokenFromERPNext(email, token) {
    try {
        const apiKey = 'ef122a54da1bfed';
        const apiSecret = 'f80c4ce51758a2a';
        // Construct the document ID or URL path based on your naming scheme
        const docId = `${email}-${token}`;

        // Make the DELETE request to ERPNext
        const response = await fetch(`https://erpnoveloffice.in/api/resource/Expo Token/${docId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${apiKey}:${apiSecret}`
                
            },
        });

        if (!response.ok) {
            throw new Error('Failed to delete the Expo Token document from ERPNext');
        }

        console.log('Expo Token document successfully deleted from ERPNext.');
    } catch (error) {
        console.error('Error deleting the Expo Token document from ERPNext:', error);
    }
}



if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        
        <ActivityIndicator size="large" color="#0000ff" /> 
        
      </View>
    );
  }
  

  return (
    <SafeAreaView style={styles.container}>
      {!isLoggedIn ? (
        
        <View style={styles.loginContainer}>
            <Image style={styles.logo_image} source={require('./assets/novel_logo.png')} />
          <TextInput
            style={styles.input}
            onChangeText={setUserEmail}
            value={userEmail}
            placeholder="Email"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            onChangeText={setUserPassword}
            value={userPassword}
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
          />
          <Button title="Login" onPress={handleLogin} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <WebView 
            source={{ uri: ERPNextURL }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={{ flex: 1 }}
          />
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  loginContainer: {
    alignItems: 'center',
    padding: 20,
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
    width: '80%',
  },
  logoutButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'red',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  logo_image:{
    height : 200,
    width:200
  },
  logoutButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

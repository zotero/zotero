// Test configuration loading
import amplifyConfig from './amplifyconfiguration.js';

// Test function to verify configuration
export function testConfiguration() {
    try {
        console.log('Testing AWS Cognito configuration...');
        
        // Check required fields
        const requiredFields = [
            'aws_user_pools_id',
            'aws_user_pools_web_client_id',
            'aws_project_region'
        ];
        
        for (const field of requiredFields) {
            if (!amplifyConfig[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        console.log('Configuration test passed!');
        console.log('User Pool ID:', amplifyConfig.aws_user_pools_id);
        console.log('Client ID:', amplifyConfig.aws_user_pools_web_client_id);
        console.log('Region:', amplifyConfig.aws_project_region);
        
        return true;
    } catch (error) {
        console.error('Configuration test failed:', error.message);
        return false;
    }
}

// Export configuration for testing
export { amplifyConfig }; 
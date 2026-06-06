const fs = require('fs');

let content = fs.readFileSync('routes/auth.js', 'utf-8');

// Replace SQL column references
content = content.replace(/\[UserID\]/g, '[user_id]');
content = content.replace(/\[Email\]/gi, '[email]');
content = content.replace(/\[Username\]/g, '[username]');
content = content.replace(/\[PhoneNumber\]/g, '[phone_number]');
content = content.replace(/\[PasswordHash\]/g, '[password_hash]');
content = content.replace(/\[AccountStatus\]/g, '[status]');
content = content.replace(/\[EmailVerified\]/g, '[is_email_verified]');
content = content.replace(/\[AvatarUrl\]/g, '[avatar_url]');
content = content.replace(/\[CreatedAt\]/g, '[created_at]');
content = content.replace(/\[UpdatedAt\]/g, '[updated_at]');
content = content.replace(/\[LastLoginAt\]/g, '[last_login_at]');

// Replace object properties
content = content.replace(/\.UserID\b/g, '.user_id');
content = content.replace(/\.Email\b/g, '.email');
content = content.replace(/\.Username\b/g, '.username');
content = content.replace(/\.PhoneNumber\b/g, '.phone_number');
content = content.replace(/\.PasswordHash\b/g, '.password_hash');
content = content.replace(/\.AccountStatus\b/g, '.status');
content = content.replace(/\.EmailVerified\b/g, '.is_email_verified');
content = content.replace(/\.AvatarUrl\b/g, '.avatar_url');

// Fix LockoutUntil
content = content.replace(/if \(user\.LockoutUntil && new Date\(user\.LockoutUntil\)\.getTime\(\) > Date\.now\(\)\) {[\s\S]*?}/g, '');

// Fix FailedLoginCount
content = content.replace(/, \[FailedLoginCount\] = 0/g, '');

fs.writeFileSync('routes/auth.js', content, 'utf-8');
console.log('Fixed auth.js');

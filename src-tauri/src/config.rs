/// Domains allowed to navigate within the webview (Microsoft auth + OneNote ecosystem).
/// Any URL not matching these domains will be opened in the system browser.
///
/// This covers personal accounts, org/work accounts (Entra ID), and
/// school/edu accounts (federated ADFS + Entra ID SSO).
pub const ALLOWED_DOMAINS: &[&str] = &[
    // OneNote core
    "onenote.com",
    "onenote.officeapps.live.com",
    // Microsoft auth (personal + org/edu)
    "microsoft.com",
    "microsoftonline.com",
    "live.com",
    "login.windows.net",
    "msauth.net",
    "msftauth.net",
    "msftcloudes.com",
    "msidentity.com",
    "aadcdn.msftauth.net",
    "aadcdn.msauthimages.net",
    // Office 365 / SharePoint / OneDrive
    "office.com",
    "office.net",
    "office365.com",
    "officeapps.live.com",
    "sharepoint.com",
    "onedrive.com",
    "outlook.com",
    "svc.ms",
    // CDN and auxiliary Microsoft services
    "azure.net",
    "azureedge.net",
    "microsoft365.com",
    "ms365.eu",
];

pub const DEFAULT_URL: &str = "https://www.onenote.com/notebooks";

pub const APP_USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/// Domains commonly used by federated identity providers (school/org SSO).
/// These are allowed during auth flows.
pub const FEDERATED_AUTH_PATTERNS: &[&str] = &[
    "adfs.",
    "sts.",
    "sso.",
    "login.",
    "auth.",
    "idp.",
    "federation.",
];

/// Check if a URL's host matches any of the allowed domains (including subdomains),
/// or if it looks like a federated SSO endpoint (common for school/org accounts).
pub fn is_allowed_domain(url: &url::Url) -> bool {
    let host = match url.host_str() {
        Some(h) => h,
        None => return false,
    };

    // Check explicit allow-list
    let explicitly_allowed = ALLOWED_DOMAINS.iter().any(|domain| {
        host == *domain || host.ends_with(&format!(".{}", domain))
    });

    if explicitly_allowed {
        return true;
    }

    // Allow federated SSO endpoints (school/org identity providers).
    // These are identified by common SSO subdomain patterns combined with
    // auth-related URL paths.
    let path = url.path().to_lowercase();
    let is_auth_path = path.contains("/adfs")
        || path.contains("/saml")
        || path.contains("/oauth")
        || path.contains("/auth")
        || path.contains("/sso")
        || path.contains("/wsfed")
        || path.contains("/federationmetadata")
        || path.contains("/login");

    let is_sso_host = FEDERATED_AUTH_PATTERNS
        .iter()
        .any(|pattern| host.starts_with(pattern));

    is_auth_path && is_sso_host
}

#[cfg(test)]
mod tests {
    use super::*;
    use url::Url;

    #[test]
    fn test_allowed_domains() {
        // Core OneNote
        assert!(is_allowed_domain(&Url::parse("https://www.onenote.com/notebooks").unwrap()));
        assert!(is_allowed_domain(&Url::parse("https://onenote.officeapps.live.com/o/onenoteframe.aspx").unwrap()));

        // Microsoft auth
        assert!(is_allowed_domain(&Url::parse("https://login.microsoftonline.com/oauth").unwrap()));
        assert!(is_allowed_domain(&Url::parse("https://login.live.com/auth").unwrap()));

        // SharePoint (school/org notebooks)
        assert!(is_allowed_domain(&Url::parse(
            "https://eduvic.sharepoint.com/sites/BBB12AFoodStudies2026/_layouts/15/Doc.aspx"
        ).unwrap()));

        // Federated SSO endpoints (school identity providers)
        assert!(is_allowed_domain(&Url::parse("https://adfs.school.edu.au/adfs/ls/").unwrap()));
        assert!(is_allowed_domain(&Url::parse("https://login.edustar.vic.edu.au/adfs/oauth2/authorize").unwrap()));
        assert!(is_allowed_domain(&Url::parse("https://sso.university.edu/saml2/idp/SSOService").unwrap()));
        assert!(is_allowed_domain(&Url::parse("https://sts.myschool.edu/auth/realms/master").unwrap()));

        // External sites should still be blocked
        assert!(!is_allowed_domain(&Url::parse("https://www.google.com").unwrap()));
        assert!(!is_allowed_domain(&Url::parse("https://example.com").unwrap()));
        assert!(!is_allowed_domain(&Url::parse("https://random-site.com/login").unwrap()));
    }
}

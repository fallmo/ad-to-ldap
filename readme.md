# AD to LDAP conversion

### Notes

ansible-galaxy collection install ansible.windows

yum install -y python38 python3-winrm.noarch

Set-Item -Force WSMan:\localhost\Service\auth\Basic $true
same with unencrypted

winrm get winrm/config

winrm configsddl default (for user winrm access)

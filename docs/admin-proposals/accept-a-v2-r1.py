#!/usr/bin/env python3
"""Independent A-v2 receipt. inspect/verify read only; attest writes ONE new receipt.
No mount, SQL, start, stop, reset-failed, or historical file write.
"""
import datetime, hashlib, json, os, pwd, socket, stat, subprocess, sys
from pathlib import Path
REVIEW=Path('/root/dental-pg-recipe-v2-review')
CONTROL=Path('/root/dental-pg-recipe-v2-control-r1')
BASE=Path('/var/lib/dental-lab-pg-recipe-v2')
IMAGE=BASE/'sandbox.raw'
ATTESTATION=CONTROL/'A-v2-attestation-r1.json'
MANIFEST='c5653bcf1de9393f9a93a864fede4cb6a4b17794a49b3c257c0b946e4340ac4e'
SERVICES=['postgresql@17-main','nginx','pm2-debian','dental-site','dental-ai-remote']
DATA='/var/lib/dental-lab-bootstrap-reception'
class Refused(RuntimeError): pass
def require(value,message):
    if not value: raise Refused(message)
def run(args,allowed=(0,)):
    r=subprocess.run(args,capture_output=True,text=True,timeout=20,
        env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LC_ALL':'C'})
    require(r.returncode in allowed, 'COMMAND_FAILED '+repr(args)+' rc='+str(r.returncode)+' '+r.stderr.strip())
    return r
def read(path,limit=64*1024*1024,owner=0):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        s=os.fstat(fd)
        require(stat.S_ISREG(s.st_mode) and (owner is None or s.st_uid==owner) and s.st_nlink==1 and not s.st_mode&0o022,'UNSAFE_FILE '+str(path))
        require(s.st_size<=limit,'FILE_TOO_LARGE')
        with os.fdopen(os.dup(fd),'rb') as f: data=f.read(limit+1)
        require(len(data)==s.st_size,'FILE_CHANGED')
        return data
    finally: os.close(fd)
def digest(data):return hashlib.sha256(data).hexdigest()
def image_digest():
    fd=os.open(IMAGE,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        before=os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid==0 and stat.S_IMODE(before.st_mode)==0o600 and before.st_size==536870912,'IMAGE_IDENTITY')
        h=hashlib.sha256()
        while True:
            chunk=os.read(fd,1024*1024)
            if not chunk:break
            h.update(chunk)
        after=os.fstat(fd)
        require((before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns),'IMAGE_CHANGED')
        return {'sha256':h.hexdigest(),'device':before.st_dev,'inode':before.st_ino,'size':before.st_size,'mtime_ns':before.st_mtime_ns}
    finally:os.close(fd)
def properties(text):
    return dict(line.split('=',1) for line in text.splitlines() if '=' in line)
def successful_service(text):
    p=properties(text)
    require(all(p.get(k)==v for k,v in {'ActiveState':'inactive','SubState':'dead','Result':'success','ExecMainStatus':'0'}.items()),'A_SERVICE_PROOF_INVALID')
def journal_matches(text,proof):
    for line in text.splitlines():
        offset=line.find('{')
        if offset<0:continue
        try:
            obj=json.loads(line[offset:])
        except ValueError:continue
        if obj==proof:return
    raise Refused('A_JOURNAL_PROOF_MISSING')
def host_idle():
    mounts=run(['findmnt','-rn','-o','TARGET']).stdout.splitlines()
    for suffix,user in [('', 'dental-pg-test'),('-v2','dental-pg-test-v2')]:
        base='/var/lib/dental-lab-pg-recipe'+suffix
        require(not any(x==base+'/mount' or x.startswith(base+'/mount/') for x in mounts),'MOUNT_PRESENT')
        require(not run(['losetup','-j',base+'/sandbox.raw']).stdout.strip(),'LOOP_PRESENT')
        pwd.getpwnam(user) # Never interpret unknown UID as no process.
        r=run(['pgrep','-a','-u',user],(0,1))
        require(r.returncode==1 and not r.stdout,'PROCESS_PRESENT')
        for mode in ['isolation','test']:
            unit='dental-pg-recipe'+suffix+'@'+mode+'.service'
            p=properties(run(['systemctl','show',unit,'-p','ActiveState','-p','SubState','-p','MainPID','-p','DropInPaths']).stdout)
            allowed=('inactive','failed') if not suffix else ('inactive',)
            require(p.get('ActiveState') in allowed and p.get('MainPID')=='0','UNIT_NOT_IDLE '+unit)
            if suffix:require(p.get('SubState')=='dead' and p.get('DropInPaths')=='','V2_UNIT_CHANGED')
def debug(command):
    r=run(['/usr/sbin/debugfs','-R',command,str(IMAGE)])
    # debugfs sometimes exits 0 even when its internal command fails.
    errors=[x for x in r.stderr.splitlines() if x.strip() and not x.startswith('debugfs ')]
    require(not errors,'DEBUGFS_DIAGNOSTIC '+repr(errors))
    return r.stdout
def entries(path):
    result={}
    for line in debug('ls -p '+path).splitlines():
        if not line:continue
        fields=line.split('/')
        require(len(fields)>=7 and fields[1].isdigit(),'DEBUGFS_LIST_FORMAT')
        if fields[1]=='0':continue
        result[fields[5]]=fields
    return result
def validate():
    require(os.getuid()==0 and socket.gethostname()=='vps-28bf7789','WRONG_OPERATOR')
    for ns in ['mnt','net']:
        require(os.readlink('/proc/self/ns/'+ns)==os.readlink('/proc/1/ns/'+ns),'NOT_HOST_NAMESPACE')
    for folder in [REVIEW,CONTROL,BASE]:
        s=folder.lstat()
        require(stat.S_ISDIR(s.st_mode) and s.st_uid==0 and stat.S_IMODE(s.st_mode)==0o700,'UNSAFE_DIRECTORY '+str(folder))
    require(not os.path.lexists(REVIEW/'A.ok'),'UNEXPECTED_A_OK')
    require(not os.path.lexists(REVIEW/'B.attempt') and not os.path.lexists(REVIEW/'B-start.txt'),'B_ALREADY_ATTEMPTED')
    require(not os.path.lexists(CONTROL/'B-r1.attempt'),'NEW_B_ALREADY_ATTEMPTED')
    control_manifest=read(CONTROL/'CONTROL_SHA256SUMS')
    control_names=set()
    for line in control_manifest.decode().splitlines():
        sha,name=line.split()
        require(name in {'accept-a-v2-r1.py','reception-v2-common-r1.sh','reception-v2-b-r1.sh'} and name not in control_names,'CONTROL_MANIFEST_INVALID')
        control_names.add(name)
        require(digest(read(CONTROL/name))==sha,'CONTROL_ARTIFACT_CHANGED')
    require(len(control_names)==3,'CONTROL_MANIFEST_COUNT')
    evidence={}
    def evidence_read(name):
        b=read(REVIEW/name);evidence[name]=digest(b);return b
    manifest=evidence_read('SHA256SUMS')
    require(digest(manifest)==MANIFEST,'HISTORICAL_MANIFEST_MISMATCH')
    names=set()
    for line in manifest.decode().splitlines():
        sha,name=line.split()
        require('/' not in name and name not in names,'INVALID_MANIFEST')
        names.add(name)
        require(digest(evidence_read(name))==sha,'HISTORICAL_ARTIFACT_MISMATCH '+name)
    require(len(names)==7,'MANIFEST_COUNT')
    require(read('/run/systemd/system/dental-pg-recipe-v2@.service')==read(REVIEW/'dental-pg-recipe-v2@.service'),'INSTALLED_UNIT_CHANGED')
    require(read(BASE/'dental-pg-recipe-v2@.service')==read(REVIEW/'dental-pg-recipe-v2@.service'),'BASE_UNIT_CHANGED')
    evidence_read('A.attempt')
    evidence_read('A-start.txt')
    successful_service(evidence_read('A-service.txt').decode())
    journal=evidence_read('A-journal.txt').decode()
    for before,after in [('state-before.txt','state-after-A.txt'),('pg-config-before.sha256','pg-config-after-A.sha256'),('sockets-before.txt','sockets-after-A.txt')]:
        require(evidence_read(before)==evidence_read(after),'BEFORE_AFTER_MISMATCH '+before)
    # Preserve/bind the historical diagnostic if present; never rewrite it.
    if os.path.lexists(REVIEW/'diagnostic-A.txt'):evidence_read('diagnostic-A.txt')
    host_idle()
    state=run(['systemctl','show',*SERVICES,'-p','Id','-p','ActiveState','-p','MainPID','-p','ExecMainStartTimestampMonotonic']).stdout.encode()
    require(state==read(REVIEW/'state-before.txt'),'CURRENT_SERVICES_CHANGED')
    require(state.decode().count('ActiveState=active')==len(SERVICES),'PRODUCTION_SERVICE_INACTIVE')
    sockets='\n'.join(sorted(run(['ss','-H','-lnt']).stdout.splitlines()))+'\n'
    require(sockets.encode()==read(REVIEW/'sockets-before.txt'),'CURRENT_SOCKETS_CHANGED')
    configdir=Path('/etc/postgresql/17/main')
    # Same regular-file coverage as the original find -type f; compare full list too.
    configs=''.join(sorted(digest(read(p,owner=None))+'  '+str(p)+'\n' for p in configdir.rglob('*') if p.is_file() and not p.is_symlink()))
    require(configs.encode()==read(REVIEW/'pg-config-before.sha256'),'CURRENT_CONFIG_CHANGED')
    run(['runuser','-u','postgres','--','/usr/lib/postgresql/17/bin/pg_isready','-h','/var/run/postgresql','-p','5432','-t','3'])
    before=image_digest()
    identity=json.loads(read(BASE/'identity.json'))
    require(json.loads(debug('cat /etc/reception-identity.json'))==identity,'IMAGE_IDENTITY_CHANGED')
    u=pwd.getpwnam('dental-pg-test-v2')
    require((identity['uid'],identity['gid'])==(u.pw_uid,u.pw_gid),'UID_GID_CHANGED')
    files=entries(DATA)
    require(set(files)=={'.','..','isolation.json'},'UNEXPECTED_RECEPTION_FILES')
    require('reception-test-approved' not in entries('/etc'),'TEST_APPROVAL_ALREADY_PRESENT')
    proof=json.loads(debug('cat '+DATA+'/isolation.json'))
    require(proof.get('result')=='isolation-passed' and proof.get('mode')=='isolation' and proof.get('uid')==u.pw_uid,'ISOLATION_PROOF_INVALID')
    require(proof.get('cgroup')=='dental-pg-recipe-v2@isolation.service' and proof.get('netns')!=identity['host_netns'],'ISOLATION_CONTEXT_INVALID')
    journal_matches(journal,proof)
    require(debug('cat /recipe/runner.sh').encode()==read(REVIEW/'isolated-pg-recipe-v2-runner.sh'),'IMAGE_RUNNER_CHANGED')
    host_idle()
    require(before==image_digest(),'IMAGE_CHANGED_DURING_INSPECTION')
    return {'schema':'dental-a-v2-independent-r1','decision':'accepted_existing_isolation_evidence',
        'historical_commit':'105d4436b1a7cb30b43f7e116f41486fbf03a70f','manifest_sha256':MANIFEST,
        'validator_sha256':digest(read(Path(__file__))),
        'control_manifest_sha256':digest(control_manifest),
        'evidence':evidence,'image':before,'isolation':proof,
        'scope':'phase_A_only_not_authorization_for_B'}
def compare_receipt(receipt,observed):
    require(isinstance(receipt,dict) and receipt.get('validation')==observed,'ATTESTATION_STALE_OR_INVALID')
    require(isinstance(receipt.get('validated_at_utc'),str),'ATTESTATION_DATE_MISSING')
    when=datetime.datetime.fromisoformat(receipt['validated_at_utc'])
    require(when.tzinfo is not None and when<=datetime.datetime.now(datetime.timezone.utc),'ATTESTATION_DATE_INVALID')
def main():
    require(len(sys.argv)==2 and sys.argv[1] in ('inspect','attest','verify'),'MODE_REQUIRED')
    mode=sys.argv[1]
    if mode=='attest':require(not os.path.lexists(ATTESTATION),'ATTESTATION_ALREADY_EXISTS')
    observed=validate()
    if mode=='verify':
        st=ATTESTATION.lstat()
        require(stat.S_IMODE(st.st_mode)==0o400,'ATTESTATION_MODE')
        compare_receipt(json.loads(read(ATTESTATION)),observed)
        print('A_V2_INDEPENDENT_ATTESTATION_VERIFIED')
    elif mode=='inspect':
        print(json.dumps({'result':'A_V2_EVIDENCE_INSPECTION_PASSED','validation':observed},indent=2))
    else:
        payload={'validated_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'validation':observed}
        fd=os.open(ATTESTATION,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o400)
        with os.fdopen(fd,'w') as f:
            json.dump(payload,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
        directory=os.open(CONTROL,os.O_RDONLY|os.O_DIRECTORY)
        try:os.fsync(directory)
        finally:os.close(directory)
        print('A_V2_INDEPENDENT_ATTESTATION_CREATED')
if __name__=='__main__':
    try:main()
    except Exception as e:print('REFUSED: '+str(e),file=sys.stderr);sys.exit(1)

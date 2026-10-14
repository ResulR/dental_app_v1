#!/usr/bin/python3
"""Administrative proposal. Creates ONLY the explicitly approved isolated test envelope.
Never invoked by npm, the AI account, or an application endpoint. Does not start PG.
"""
import hashlib, json, os, pwd, shutil, socket, stat, subprocess, tarfile
from pathlib import Path

base = Path('/var/lib/dental-lab-pg-recipe-v3')
review = Path('/root/dental-pg-recipe-v3-review')
root = base / 'mount'
env = {'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C.UTF-8','HOME':'/root'}
def run(*args):
    subprocess.run(args, env=env, stdin=subprocess.DEVNULL, check=True, timeout=60)
def verified(name, digest, max_size):
    p=review/name
    fd=os.open(p, os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        s=os.fstat(fd)
        assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1
        assert not s.st_mode&0o077 and 0<s.st_size<=max_size
        with os.fdopen(os.dup(fd),'rb') as f:data=f.read(max_size+1)
    finally:os.close(fd)
    assert len(data)==s.st_size and hashlib.sha256(data).hexdigest()==digest
    return data
def write(path, data, mode=0o444):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('xb') as f:f.write(data)
    path.chmod(mode)

assert os.getuid()==0 and os.environ.get('DENTAL_PG_RECIPE_ENVELOPE_APPROVED')=='v3'
assert socket.gethostname()=='vps-28bf7789'
assert os.readlink('/proc/self/ns/net')==os.readlink('/proc/1/ns/net')
assert not os.path.lexists(base)
assert not Path('/run/systemd/system/dental-pg-recipe-v3@.service').exists()
try:
    pwd.getpwnam('dental-pg-test-v3')
except KeyError:pass
else:raise AssertionError('DEDICATED_USER_ALREADY_EXISTS')
assert shutil.disk_usage('/var/lib').free >= 2*1024**3
mem=dict(line.split(':',1) for line in Path('/proc/meminfo').read_text().splitlines())
assert int(mem['MemAvailable'].split()[0]) >= 2*1024**2
assert os.getloadavg()[0] < 2
for path in ('/usr/sbin/mkfs.ext4','/usr/bin/mount','/usr/bin/umount',
             '/usr/sbin/useradd','/usr/bin/systemd-analyze'):
    assert os.access(path,os.X_OK)
assert subprocess.check_output(['/usr/lib/postgresql/17/bin/postgres','--version'],env=env).decode().startswith('postgres (PostgreSQL) 17.')
assert subprocess.check_output(['/usr/bin/node','--version'],env=env).decode().strip()=='v22.22.2'
runner=verified('isolated-pg-recipe-v3-runner.sh','2ab6f7bada821c5be680ad4262d912b3497c716141283c23cac8d19080596b10',32768)
unit=verified('dental-pg-recipe-v3@.service','b4c4433e7f5f5dd7f007d5e0d2c13e8b30405c7372373d8e645f0301a7e74ef0',16384)
archive=verified('owner-bootstrap-review-v3.tar.gz','488be4f1277fbc933157252f270f0cc7e3c66b8218535265b87c809ecba365dd',52428800)
os.umask(0o077)
base.mkdir(mode=0o700)
# No rollback/retry after a partial operation: retain all state for diagnosis.
run('/usr/sbin/useradd','--system','--user-group','--no-create-home',
    '--home-dir','/nonexistent','--shell','/usr/sbin/nologin','dental-pg-test-v3')
user=pwd.getpwnam('dental-pg-test-v3')
assert user.pw_uid not in (0,103,994,1002)
image=base/'sandbox.raw'
fd=os.open(image,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
try:os.posix_fallocate(fd,0,536870912)
finally:os.close(fd)
run('/usr/sbin/mkfs.ext4','-q','-F','-m','0',str(image))
root.mkdir(mode=0o700)
run('/usr/bin/mount','-o','loop,nodev,nosuid',str(image),str(root))
root.chmod(0o755)
for directory in ('usr/bin','usr/lib','usr/lib64','usr/share','proc','sys','dev','run','tmp','etc','recipe'):
    (root/directory).mkdir(parents=True,exist_ok=True,mode=0o755)
for name,target in (('bin','usr/bin'),('lib','usr/lib'),('lib64','usr/lib64')):
    (root/name).symlink_to(target)
(root/'var').mkdir(exist_ok=True)
(root/'var/run').symlink_to('/run')
identity={'uid':user.pw_uid,'gid':user.pw_gid,
          'host_netns':os.readlink('/proc/self/ns/net'),
          'host_mntns':os.readlink('/proc/self/ns/mnt')}
write(root/'etc/reception-identity.json',json.dumps(identity).encode())
write(root/'etc/passwd',('root:x:0:0:root:/root:/usr/sbin/nologin\n'
    +f'dental-pg-test-v3:x:{user.pw_uid}:{user.pw_gid}:isolated test:/nonexistent:/usr/sbin/nologin\n').encode())
write(root/'etc/group',f'root:x:0:\ndental-pg-test-v3:x:{user.pw_gid}:\n'.encode())
write(root/'etc/nsswitch.conf',b'passwd: files\ngroup: files\nhosts: files\n')
write(root/'recipe/runner.sh',runner)
data=root/'var/lib/dental-lab-bootstrap-reception'
data.mkdir(parents=True,mode=0o700)
os.chown(data,user.pw_uid,user.pw_gid)
release=root/'var/lib/dental-lab-owner-bootstrap-v1/release'
# Same frozen bundle, not a freshly rebuilt variant.
import io
with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as tar:
    members=tar.getmembers()
    assert len(members)==len({m.name for m in members})==1650
    assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in members)
    assert sum(m.size for m in members)<52428800
    manifest=json.load(tar.extractfile('MANIFEST.json'))
    assert set(manifest)=={m.name for m in members if m.name!='MANIFEST.json'}
    for m in members:
        content=tar.extractfile(m).read()
        if m.name!='MANIFEST.json':assert hashlib.sha256(content).hexdigest()==manifest[m.name]
        write(release/m.name,content,0o440)
        os.chown(release/m.name,0,user.pw_gid)
for directory in [release, *[p for p in release.rglob('*') if p.is_dir()]]:
    os.chown(directory,0,user.pw_gid)
    directory.chmod(0o750)
# mkdir obeyed umask077: explicitly permit traversal of the synthetic root.
for directory in ('usr','usr/bin','usr/lib','usr/lib64','usr/share','proc','sys',
                  'dev','run','tmp','etc','recipe','var','var/lib',
                  'var/lib/dental-lab-owner-bootstrap-v1'):
    (root/directory).chmod(0o755)
write(base/'identity.json',json.dumps(identity).encode(),0o400)
write(base/'dental-pg-recipe-v3@.service',unit,0o400)
run('/usr/bin/umount',str(root))
print('ENVELOPE_PREPARED_NO_POSTGRES_STARTED')
